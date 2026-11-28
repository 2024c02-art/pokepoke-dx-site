// Regression checks for generic on-evolution Ability parsing and resolution.
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
const parserContext={
  energyMap:typeMap,
  energyEffectType(value){return typeMap[String(value||'').toUpperCase()]||null;}
};
const parserCases=[
  ['Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may draw 2 cards.','drawCardsOnEvolve',2],
  ["Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may discard a random Energy from your opponent's Active Pokémon.",'discardRandomOpponentActiveEnergyOnEvolve'],
  ['Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may heal 60 damage from 1 of your [W] Pokémon.','healOwnOneOnEvolve',60],
  ['Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may put a Supporter card from your discard pile into your hand.','recoverSupporterFromDiscardOnEvolve'],
  ["Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may have your opponent shuffle their hand into their deck. For each remaining point that your opponent needs to win, they draw a card.",'shuffleOpponentHandDrawPointsOnEvolve'],
  ['Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may put 2 random Pokémon Tool cards from your discard pile into your hand.','recoverRandomToolsOnEvolve',2],
  ["Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may do 20 damage to your opponent's Active Pokémon.",'damageOpponentActiveOnEvolve',20],
  ["Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may prevent all damage from—and effects of—attacks from your opponent's Pokémon done to this Pokémon until the end of your opponent's next turn.",'preventAttackDamageOnEvolve'],
  ["Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed.",'paralyzeOpponentActiveOnEvolve'],
  ['Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may look at the top 4 cards of your deck and put all Item cards you find there into your hand. Shuffle the other cards back into your deck.','takeTopItemCardsOnEvolve'],
  ["Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may make your opponent's Active Pokémon Poisoned and Burned.",'poisonBurnOpponentActiveOnEvolve'],
  ["Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may move a random Energy from your opponent's Active Pokémon to this Pokémon.",'moveRandomOpponentActiveEnergyToSelfOnEvolve'],
  ['Once during your turn, when you play this card from your hand to evolve 1 of your Pokémon, you may use this Ability. Put a random Frogadier from your deck onto your Bench.','searchRandomCardInDeck']
];
for(const [text,action,amount] of parserCases){
  const parsed=parseAbility.call(parserContext,text);
  assert.equal(parsed?.trigger,'onEvolve','must recognize on-evolution timing: '+text);
  assert.equal(parsed?.action,action,'wrong parsed action for: '+text);
  if(amount!==undefined)assert.equal(parsed.amount,amount,'wrong parsed amount for: '+text);
}

const CARD_MAP={
  source:{name:'Source',category:'Pokemon',type:'Water'},
  water:{name:'Water Pokémon',category:'Pokemon',type:'Water'},
  opponent:{name:'Opponent',category:'Pokemon',type:'Fire'},
  sylveon:{name:'Sylveon ex',category:'Pokemon',ability:{name:'Happy Ribbon',genericEffect:{trigger:'onEvolve',action:'drawCardsOnEvolve',amount:2}}},
  milotic:{name:'Milotic',category:'Pokemon',ability:{name:'Healing Aqua',genericEffect:{trigger:'onEvolve',action:'healOwnOneOnEvolve',amount:60,targetPokemonType:'Water'}}},
  inteleon:{name:'Inteleon',category:'Pokemon',ability:{name:'Power Shot',genericEffect:{trigger:'onEvolve',action:'damageOpponentActiveOnEvolve',amount:30}}},
  delcatty:{name:'Delcatty',category:'Pokemon',ability:{name:'Search Supporter',genericEffect:{trigger:'onEvolve',action:'recoverSupporterFromDiscardOnEvolve'}}},
  polteageist:{name:'Polteageist',category:'Pokemon',ability:{name:'Tea Time',genericEffect:{trigger:'onEvolve',action:'shuffleOpponentHandDrawPointsOnEvolve'}}},
  perrserker:{name:'Galarian Perrserker',category:'Pokemon',ability:{name:'Tool Recovery',genericEffect:{trigger:'onEvolve',action:'recoverRandomToolsOnEvolve',amount:2}}},
  samurott:{name:'Samurott',category:'Pokemon',ability:{name:'Aqua Blade',genericEffect:{trigger:'onEvolve',action:'preventAttackDamageOnEvolve'}}},
  raichu:{name:'Raichu',category:'Pokemon',ability:{name:'Thunderous Presence',genericEffect:{trigger:'onEvolve',action:'paralyzeOpponentActiveOnEvolve'}}},
  raticate:{name:'Raticate',category:'Pokemon',ability:{name:'Top Search',genericEffect:{trigger:'onEvolve',action:'takeTopItemCardsOnEvolve'}}},
  weezing:{name:"Team Rocket's Weezing ex",category:'Pokemon',ability:{name:'Gas Leak',genericEffect:{trigger:'onEvolve',action:'poisonBurnOpponentActiveOnEvolve'}}},
  rocketRaticate:{name:"Team Rocket's Raticate ex",category:'Pokemon',ability:{name:'Energy Swipe',genericEffect:{trigger:'onEvolve',action:'moveRandomOpponentActiveEnergyToSelfOnEvolve'}}},
  frogadier:{name:'Frogadier',category:'Pokemon',ability:{name:'Swift Evolution',genericEffect:{trigger:'onEvolve',action:'searchRandomCardInDeck',searchDeckTarget:'bench',searchDeckCategory:'Pokemon',searchDeckNames:['Frogadier']}}},
  supporter:{name:'Supporter',category:'Trainer',subType:'Supporter'},
  toolA:{name:'Tool A',category:'Trainer',subType:'Tool'},
  toolB:{name:'Tool B',category:'Trainer',subType:'Tool'},
  itemA:{name:'Item A',category:'Trainer',subType:'Item'},
  itemB:{name:'Item B',category:'Trainer',subType:'Item'},
  filler:{name:'Filler',category:'Pokemon',type:'Colorless'}
};
const resolve=new Function(
  'CARD_MAP','getCardDisplayName','ui','sound','battleVfx','TYPE_META','escapeHtml',
  'return ({'+method('resolveOnEvolveAbility')+'}).resolveOnEvolveAbility;'
)(
  CARD_MAP,card=>card?.name||'Pokémon',
  {toast(){},openSelectModal(){},renderMiniCard(){return '';}},
  {energy(){}},{triggerBurst(){}},
  {Water:{code:'水'},Fire:{code:'炎'},Colorless:{code:'無'}},
  value=>String(value)
);
function pokemon(cardId,hp=100,energies=[]){return {cardId,hp,maxHp:100,energies:[...energies],statusEffects:[],abilityUsed:false};}
function context(pActive,pBench=[],oActive=null,oBench=[]){
  return {
    turn:4,actionLocked:false,isOnlineP2P:false,over:false,
    p:{active:pActive,bench:pBench,hand:[],discard:[],deck:[],energyTypes:['Water','Fire'],points:0,name:'Player'},
    o:{active:oActive,bench:oBench,hand:[],discard:[],deck:[],energyTypes:['Water','Fire'],points:0,name:'CPU'},
    log(message){(this.logs||(this.logs=[])).push(message);},
    render(){},syncToPeer(){},nightmareAura(){},showDmg(){},
    shuffle(cards){return cards.slice();},
    drawCards(side,count){
      const board=side==='player'?this.p:this.o;
      const drawn=board.deck.splice(0,Math.max(0,Number(count)||0));
      board.hand.push(...drawn);
      return drawn.length;
    },
    applySpecialCondition(inst,status){inst.statusEffects.push(status);return true;},
    checkKO(side,zone,index,isBench){
      this.lastKO={side,zone,index,isBench};
      return true;
    },
    resolveRandomDeckSearch(side,effect,label){
      this.lastSearch={side,effect,label};
      return true;
    },
    createInst(cardId){return pokemon(cardId);}
  };
}

// Sylveon: draw two cards after accepting the optional Ability.
let ctx=context(pokemon('sylveon'));
ctx.p.deck=['itemA','itemB','filler'];
assert.equal(resolve.call(ctx,'player','active',0,true),true);
assert.deepEqual(ctx.p.hand,['itemA','itemB']);
assert.equal(ctx.p.deck.length,1);
assert.equal(ctx.p.active.abilityUsed,true);

// Milotic: choose a damaged Water Pokémon and heal exactly the printed amount.
ctx=context(pokemon('water',30),[pokemon('milotic')]);
assert.equal(resolve.call(ctx,'player','bench',0,true),true);
assert.equal(ctx.p.active.hp,90);

// Inteleon: Active damage must use the Active Knock Out path.
ctx=context(pokemon('inteleon'),[],pokemon('opponent',20),[pokemon('source')]);
assert.equal(resolve.call(ctx,'player','active',0,true),true);
assert.deepEqual(ctx.lastKO,{side:'opp',zone:'active',index:0,isBench:false});

// Delcatty: recover a Supporter, not another Trainer subtype.
ctx=context(pokemon('delcatty'));
ctx.p.discard=['toolA','supporter','itemA'];
assert.equal(resolve.call(ctx,'player','active',0,true),true);
assert.deepEqual(ctx.p.hand,['supporter']);
assert.deepEqual(ctx.p.discard,['toolA','itemA']);

// Polteageist: opponent shuffles its hand and draws for the points still needed.
ctx=context(pokemon('polteageist'));
ctx.o.points=1;ctx.o.hand=['filler','itemA'];ctx.o.deck=['toolA','toolB','itemB'];
assert.equal(resolve.call(ctx,'player','active',0,true),true);
assert.equal(ctx.o.discard.length,0);
assert.equal(ctx.o.hand.length,2);
assert.equal(ctx.o.deck.length,3);
assert.equal(ctx.o.hand.every(id=>['toolA','toolB','itemB'].includes(id)),true);

// Perrserker: recover two random Pokémon Tools without recovering Items.
ctx=context(pokemon('perrserker'));
ctx.p.discard=['toolA','itemA','toolB'];
const oldRandom=Math.random;
Math.random=()=>0;
try{assert.equal(resolve.call(ctx,'player','active',0,true),true);}
finally{Math.random=oldRandom;}
assert.equal(ctx.p.hand.length,2);
assert.equal(ctx.p.hand.every(id=>id==='toolA'||id==='toolB'),true);
assert.deepEqual(ctx.p.discard,['itemA']);

// Samurott: the protection lasts through the opponent's next turn.
ctx=context(pokemon('samurott'));
assert.equal(resolve.call(ctx,'player','active',0,true),true);
assert.equal(ctx.p.active.preventAttackDamageUntilTurn,5);

// Weezing: apply both Special Conditions through the central status handler.
ctx=context(pokemon('weezing'),[],pokemon('opponent'));
assert.equal(resolve.call(ctx,'player','active',0,true),true);
assert.deepEqual(ctx.o.active.statusEffects,['Poisoned','Burned']);

// Team Rocket's Raticate: transfer, rather than discard, one random Energy.
ctx=context(pokemon('rocketRaticate'),[],pokemon('opponent',100,['Fire','Water']));
Math.random=()=>0;
try{assert.equal(resolve.call(ctx,'player','active',0,true),true);}
finally{Math.random=oldRandom;}
assert.equal(ctx.o.active.energies.length,1);
assert.equal(ctx.p.active.energies.length,1);

// Frogadier: delegate the random search to the shared deck-search resolver.
ctx=context(pokemon('frogadier'));
ctx.p.deck=['filler','frogadier'];
assert.equal(resolve.call(ctx,'player','active',0,true),true);
assert.equal(ctx.lastSearch.side,'player');
assert.deepEqual(ctx.lastSearch.effect.searchDeckNames,['Frogadier']);
assert.equal(ctx.lastSearch.effect.searchDeckTarget,'bench');

// Optional Abilities can be declined and are not manually usable through useAbility.
ctx=context(pokemon('sylveon'));
assert.equal(resolve.call(ctx,'player','active',0,false),true);
assert.equal(ctx.p.active.abilityUsed,true);

console.log('All on-evolution Ability parser and runtime regression checks passed.');
