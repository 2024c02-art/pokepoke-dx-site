// Regression coverage for shuffle/draw, attack prevention coins, and automatic turn-start Abilities.
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function method(name,signature){
  const start=html.indexOf(signature||('\n      '+name+'('));
  assert.ok(start>=0,'missing '+name);
  const end=html.indexOf('\n      },',start);
  assert.ok(end>start,'missing method close '+name);
  return html.slice(start,end+8);
}
const parseGenericEffect=new Function('return ({'+method('parseGenericEffect')+'}).parseGenericEffect;')();
const parseGenericAbility=new Function('return ({'+method('parseGenericAbility')+'}).parseGenericAbility;')();
const parserContext={
  energyMap:{P:'Psychic',W:'Water'},
  energyEffectType(code){return this.energyMap[String(code).toUpperCase()]||null;}
};
const shuffleDraw=parseGenericEffect.call(parserContext,
  "Shuffle your hand into your deck. Draw a card for each card in your opponent's hand.");
assert.deepEqual(shuffleDraw,{shuffleOwnHandDrawOpponentHand:true});
const prevent=parseGenericEffect.call(parserContext,
  "Flip a coin. If tails, this attack does nothing. If heads, during your opponent's next turn, prevent all damage from—and effects of—attacks done to this Pokémon.");
assert.deepEqual(prevent,{coinCount:1,coinFailDamageZero:true,preventAttackDamageNextTurnIfHeads:true});
const startTurnAbility=parseGenericAbility.call(parserContext,
  "At the beginning of your turn, if this Pokémon is in the Active Spot, put a random [P] Pokémon from your deck into your hand.");
assert.deepEqual(startTurnAbility,{
  action:'searchRandomCardInDeck',searchDeckTarget:'hand',searchDeckCategory:'Pokemon',
  searchDeckPokemonType:'Psychic',trigger:'turnStart',requiresActive:true
});

const attack=method('attack','\n      attack(side, atkIdx, copiedAttackIdx = null, choice = null) {');
assert.match(attack,/if\(ge\.shuffleOwnHandDrawOpponentHand\)/);
assert.match(attack,/s\.deck\.push\(\.\.\.s\.hand\)/);
assert.match(attack,/const drawCount=opp\.hand\.length/);
assert.match(attack,/s\.hand\.length=0/);
assert.match(attack,/s\.deck=this\.shuffle\(s\.deck\)/);

const startTurn=method('startTurn','\n      startTurn(side) {');
assert.match(startTurn,/activeAbilityEffect\?\.trigger==='turnStart'/);
assert.match(startTurn,/this\.resolveGenericAbility\(side,'active',0\)/);
assert.match(startTurn,/!s\.active\.abilityUsed/);

const mockAbility={genericEffect:startTurnAbility};
const CARD_MAP={automaticPokemon:{ability:mockAbility}};
const RULES={DECK_OUT_LOSES:false};
const startTurnFn=new Function('CARD_MAP','RULES',
  'return ({'+startTurn+'}).startTurn;')(CARD_MAP,RULES);
const state={
  over:false,turn:3,lastCheckupTurn:3,phase:'play',currentSide:null,
  isFirstTurnPlayer:false,isOnlineP2P:false,nextEnergy:null,
  p:{active:{cardId:'automaticPokemon',abilityUsed:false},bench:[],energyTypes:['Psychic'],deck:['basic'],hand:[],supporterUsed:false,retreated:false,retreatDiscount:0,dmgBonus:0},
  drawCards(){this.drew=true;},
  pickRandomEnergy(){return 'Psychic';},
  resolveGenericAbility(...args){this.autoAbilityArgs=args;this.p.active.abilityUsed=true;},
  log(){},render(){this.rendered=true;},syncToPeer(){}
};
startTurnFn.call(state,'player');
assert.deepEqual(state.autoAbilityArgs,['player','active',0],
  'start turn must activate the Active Pokémon automatic search');
assert.equal(state.p.active.abilityUsed,true,
  'automatic Ability must be used for this turn and not remain manually reusable');
assert.equal(state.drew,true);
console.log('All turn-start and shuffle-draw effect regression checks passed.');
