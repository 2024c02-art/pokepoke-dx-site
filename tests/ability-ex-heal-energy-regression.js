// Regression coverage for healing a Pokémon ex and discarding one of its Energy.
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
const parse=new Function('return ({'+method('parseGenericAbility')+'}).parseGenericAbility;')();
const parserContext={energyMap:typeMap,energyEffectType(value){return typeMap[String(value||'').toUpperCase()]||null;}};
const effectText='Once during your turn, you may heal 60 damage from 1 of your Pokémon ex that has any Energy attached. If you do, discard a random Energy from that Pokémon.';
const effect=parse.call(parserContext,effectText);
assert.equal(effect?.action,'healOwnOne');
assert.equal(effect?.amount,60);
assert.equal(effect?.requiresPokemonEx,true);
assert.equal(effect?.requiresTargetEnergy,true);
assert.equal(effect?.discardRandomEnergyFromTarget,true);

const CARD_MAP={
  arboliva:{name:'Arboliva',category:'Pokemon',ability:{name:'Healing Harvest',passive:false,genericEffect:effect}},
  exTarget:{name:'Pokémon ex',category:'Pokemon',isEx:true,type:'Grass',hp:150},
  nonExTarget:{name:'Pokémon',category:'Pokemon',isEx:false,type:'Grass',hp:100}
};
const uiCalls=[];
const ui={toast(message){uiCalls.push(message);},openSelectModal(){},renderMiniCard(){return ''; }};
const resolve=new Function('CARD_MAP','ui','sound','battleVfx','TYPE_META','getCardDisplayName','escapeHtml',
  'return ({'+method('resolveGenericAbility')+'}).resolveGenericAbility;')(
  CARD_MAP,ui,{energy(){}},{triggerBurst(){}},{Fire:{code:'炎'},Water:{code:'水'}},card=>card?.name||'Pokémon',value=>String(value)
);
function pokemon(cardId,hp,energies=[]){
  const card=CARD_MAP[cardId];
  return {cardId,hp,maxHp:card.hp||100,energies:[...energies],statusEffects:[],abilityUsed:false};
}
function context(target){
  const source=pokemon('arboliva',100);
  return {
    currentSide:'player',phase:'play',turn:4,isOnlineP2P:false,actionLocked:false,over:false,
    p:{active:target,bench:[source],hand:[],discard:[],deck:[],energyTypes:['Grass'],points:0},
    o:{active:pokemon('nonExTarget',100),bench:[],hand:[],discard:[],deck:[],points:0},
    hasPokemonNamed(){return false;},
    log(message){(this.logs||(this.logs=[])).push(message);},
    render(){},
    syncToPeer(){},
    nightmareAura(){}
  };
}

let ctx=context(pokemon('exTarget',20,['Fire','Water']));
const previousRandom=Math.random;
Math.random=()=>0;
try{assert.equal(resolve.call(ctx,'player','bench',0),true);}
finally{Math.random=previousRandom;}
assert.equal(ctx.p.active.hp,80,'the target receives the full 60-point heal');
assert.deepEqual(ctx.p.active.energies,['Water'],'one random attached Energy is discarded after healing');
assert.equal(ctx.p.bench[0].abilityUsed,true,'the Ability is spent after resolving');

// A damaged non-ex Pokémon is never an eligible target.
ctx=context(pokemon('nonExTarget',20,['Fire']));
assert.equal(resolve.call(ctx,'player','bench',0),false);
assert.equal(ctx.p.active.hp,20);
assert.equal(ctx.p.bench[0].abilityUsed,false);

// A Pokémon ex without Energy is not an eligible target either.
ctx=context(pokemon('exTarget',20,[]));
assert.equal(resolve.call(ctx,'player','bench',0),false);
assert.equal(ctx.p.active.hp,20);
assert.equal(ctx.p.bench[0].abilityUsed,false);

console.log('All Pokémon ex conditional-heal Ability regressions passed.');
