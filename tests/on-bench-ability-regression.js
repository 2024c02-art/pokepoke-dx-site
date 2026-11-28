// Regression checks for Abilities that trigger when a Pokémon is played to the Bench.
'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');

function method(name){
  const start=html.indexOf('\n      '+name+'(');
  assert.ok(start>=0,'missing method: '+name);
  const end=html.indexOf('\n      },',start);
  assert.ok(end>start,'could not find method end: '+name);
  return html.slice(start,end+9);
}

const typeMap={G:'Grass',R:'Fire',W:'Water',L:'Lightning',P:'Psychic',F:'Fighting',D:'Darkness',M:'Metal',C:'Colorless'};
const parseAbility=new Function('return ({'+method('parseGenericAbility')+'}).parseGenericAbility;')();
const parserContext={energyMap:typeMap,energyEffectType(value){return typeMap[String(value||'').toUpperCase()]||null;}};
const cases=[
  ['Once during your turn, when you put this Pokémon from your hand onto your Bench, you may have your opponent reveal their hand.','revealOpponentHandOnBench'],
  ['Once during your turn, when you put this Pokémon from your hand onto your Bench, you may switch it with your Active Pokémon. If you do, move all of your Energy in play to this Pokémon.','switchSelfToActiveMoveAllEnergy'],
  ["Once during your turn, when you put this Pokémon from your hand onto your Bench, you may switch out your opponent's Active Pokémon to the Bench. (Your opponent chooses the new Active Pokémon.)",'switchOpponentActiveOnBench'],
  ['Once during your turn, when you put this Pokémon from your hand onto your Bench, you may heal 20 damage from your Active [G] Pokémon.','healActiveOnBench',20]
];
for(const [text,action,amount] of cases){
  const parsed=parseAbility.call(parserContext,text);
  assert.equal(parsed?.trigger,'onBench','must recognize on-Bench timing: '+text);
  assert.equal(parsed?.action,action,'wrong on-Bench action for: '+text);
  if(amount!==undefined){
    assert.equal(parsed.amount,amount);
    assert.equal(parsed.targetPokemonType,'Grass');
  }
}

const CARD_MAP={
  source:{name:'Source',category:'Pokemon',type:'Colorless',ability:{name:'Energy Transfer',genericEffect:{trigger:'onBench',action:'switchSelfToActiveMoveAllEnergy'}}},
  roaring:{name:'Roaring Moon',category:'Pokemon',ability:{name:'Sudden Arrival',genericEffect:{trigger:'onBench',action:'switchOpponentActiveOnBench'}}},
  misdreavus:{name:'Misdreavus',category:'Pokemon',ability:{name:'Hand Reveal',genericEffect:{trigger:'onBench',action:'revealOpponentHandOnBench'}}},
  poltchageist:{name:'Poltchageist',category:'Pokemon',ability:{name:'Green Heal',genericEffect:{trigger:'onBench',action:'healActiveOnBench',amount:20,targetPokemonType:'Grass'}}},
  grass:{name:'Grass Pokémon',category:'Pokemon',type:'Grass'},
  opponent:{name:'Opponent',category:'Pokemon',type:'Fire'}
};
const uiCalls=[];
const ui={
  toast(){},
  renderMiniCard(id){return '<card>'+id+'</card>';},
  openSelectModal(title,content){uiCalls.push({title,content});}
};
const resolve=new Function('CARD_MAP','getCardDisplayName','ui','sound','battleVfx',
  'return ({'+method('resolveOnBenchAbility')+'}).resolveOnBenchAbility;')(
  CARD_MAP,card=>card?.name||'Pokémon',ui,{energy(){}},{triggerBurst(){}}
);
function pokemon(cardId,energies=[],hp=100){
  return {cardId,energies:[...energies],hp,maxHp:100,statusEffects:[],abilityUsed:false};
}
function context(active,bench,oppActive=null,oppBench=[]){
  return {
    turn:5,actionLocked:false,isOnlineP2P:false,over:false,
    p:{active,bench,hand:[],discard:[],deck:[],points:0},
    o:{active:oppActive,bench:oppBench,hand:[],discard:[],deck:[],points:0},
    clearSpecialConditions(inst){inst.statusEffects=[];},
    log(message){(this.logs||(this.logs=[])).push(message);},
    render(){this.renderCount=(this.renderCount||0)+1;},
    syncToPeer(){this.syncCount=(this.syncCount||0)+1;},
    resolveOpponentActiveSwitch(side){this.gustSide=side;return true;}
  };
}

// A Pokémon with the energy-transfer Ability becomes Active and gathers all of its side's Energy.
let ctx=context(pokemon('grass',['Fire','Water']),[
  pokemon('source',[]),pokemon('opponent',['Lightning'])
]);
assert.equal(resolve.call(ctx,'player',0,true),true);
assert.equal(ctx.p.active.cardId,'source');
assert.equal(ctx.p.active.movedToActiveTurn,5);
assert.deepEqual(ctx.p.active.energies,['Fire','Water','Lightning']);
assert.equal(ctx.p.bench[0].cardId,'grass');
assert.deepEqual(ctx.p.bench[0].energies,[]);
assert.deepEqual(ctx.p.bench[1].energies,[]);

// The opponent-switch Ability delegates the choice to the affected player.
ctx=context(pokemon('grass'),[pokemon('roaring')],pokemon('opponent'),[pokemon('grass')]);
assert.equal(resolve.call(ctx,'player',0,true),true);
assert.equal(ctx.gustSide,'player');

// Reveal hand displays each hidden card only after the Ability is used.
uiCalls.length=0;
ctx=context(pokemon('grass'),[pokemon('misdreavus')],pokemon('opponent'),[]);
ctx.o.hand=['opponent','grass'];
assert.equal(resolve.call(ctx,'player',0,true),true);
assert.equal(uiCalls[0].title,'相手の手札を公開');
assert.match(uiCalls[0].content,/opponent/);
assert.match(uiCalls[0].content,/grass/);

// A typed healing Ability only affects the matching Active Pokémon and caps at max HP.
ctx=context(pokemon('grass',[],80),[pokemon('poltchageist')]);
assert.equal(resolve.call(ctx,'player',0,true),true);
assert.equal(ctx.p.active.hp,100);

// Optional play-triggered Abilities offer a use/skip choice and lock input while it is open.
uiCalls.length=0;
ctx=context(pokemon('grass'),[pokemon('misdreavus')],pokemon('opponent'),[]);
assert.equal(resolve.call(ctx,'player',0,null),true);
assert.equal(ctx.actionLocked,true);
assert.equal(uiCalls.length,1);
assert.match(uiCalls[0].title,/使いますか/);

// Declining consumes the one-time play trigger and unlocks the board.
assert.equal(resolve.call(ctx,'player',0,false),true);
assert.equal(ctx.actionLocked,false);
assert.equal(ctx.p.bench[0].abilityUsed,true);

// Trigger is wired to normal hand-to-Bench play, not setup placement; it cannot be manually used again.
assert.match(html,/if\(c\.ability\?\.genericEffect\?\.trigger==='onBench'\)setTimeout\(\(\)=>\{const bi=this\.p\.bench\.indexOf\(placed\)/);
assert.match(html,/trigger==='onBench'\)\{if\(side==='player'\)ui\.toast\('この特性はベンチに出したときに発動する特性です'\);return;\}/);

console.log('All on-Bench Ability parser, trigger, and runtime regression checks passed.');
