// Regression checks for newly covered generic attack and Ability effects.
'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');

function method(name,signature){
  const start=html.indexOf(signature||('\n      '+name+'('));
  assert.ok(start>=0,'missing method: '+name);
  const end=html.indexOf('\n      },',start);
  assert.ok(end>start,'could not find method end: '+name);
  return html.slice(start,end+8);
}
const energyMap={G:'Grass',R:'Fire',W:'Water',L:'Lightning',P:'Psychic',F:'Fighting',D:'Darkness',M:'Metal',C:'Colorless'};
const parserContext={
  energyMap,
  energyEffectType(code){
    const key=String(code||'').trim().toUpperCase();
    return energyMap[key]||({GRASS:'Grass',FIRE:'Fire',WATER:'Water',LIGHTNING:'Lightning',PSYCHIC:'Psychic',FIGHTING:'Fighting',DARKNESS:'Darkness',METAL:'Metal',COLORLESS:'Colorless',DRAGON:'Dragon'})[key]||null;
  }
};
const parseAttack=new Function(`return ({${method('parseGenericEffect')}}).parseGenericEffect;`)();
const parseAbility=new Function(`return ({${method('parseGenericAbility')}}).parseGenericAbility;`)();
const costEffect=parseAttack.call(parserContext,
  "During your opponent's next turn, attacks used by the Defending Pokémon cost 1 more [W].");
assert.equal(costEffect?.defendingAttackCostIncreaseNextTurn,1);
assert.equal(costEffect?.defendingAttackCostType,'Water',
  'typed attack surcharge should preserve its Energy type');
const randomDiscard=parseAttack.call(parserContext,'Discard 2 random Energy from this Pokémon.');
assert.equal(randomDiscard?.discardRandomEnergyCount,2,
  'multiple random Energy discards should preserve the requested count');
const singleDiscard=parseAttack.call(parserContext,'Discard a random Energy from this Pokémon.');
assert.equal(singleDiscard?.discardRandomEnergyCount,1,
  'the one-Energy wording should remain compatible');

const falinksText="If you have another Falinks in play, this Pokémon's attacks do +20 damage to your opponent's Active Pokémon, and this Pokémon takes −20 damage from attacks from your opponent's Pokémon.";
const falinksEffect=parseAbility.call(parserContext,falinksText);
assert.equal(falinksEffect?.passiveAttackDamageBonusIfAnotherNamedPokemonInPlay,'Falinks');
assert.equal(falinksEffect?.passiveAttackDamageBonus,20);
assert.equal(falinksEffect?.passiveDamageReductionIfAnotherNamedPokemonInPlay,'Falinks');
assert.equal(falinksEffect?.passiveDamageReduction,20);

const CARD_MAP={
  attacker:{type:'Fighting',isEx:false,ability:{genericEffect:falinksEffect}},
  falinks:{type:'Fighting',isEx:false,sourceNameEN:'Falinks',ability:{genericEffect:falinksEffect}},
  target:{type:'Colorless',isEx:false,weakness:'None',retreat:1}
};
const calcDamage=new Function('CARD_MAP',`return ({${method('calcDamagePreview')}}).calcDamagePreview;`)(CARD_MAP);
const attackingInst={cardId:'attacker',hp:100,maxHp:100,energies:[]};
const secondFalinks={cardId:'falinks',hp:100,maxHp:100,energies:[]};
const defender={cardId:'target',hp:100,maxHp:100,energies:[]};
function damageContext(bench){
  return {
    p:{active:attackingInst,bench,dmgBonus:0,discard:[],points:0},
    o:{active:defender,bench:[],discard:[],points:0},
    turn:4,
    hasPokemonNamed:()=>false,
    energyEffectType:value=>value,
    isAttackProtected:()=>false,
    attackDamageAfterDefenses:(_inst,amount)=>amount
  };
}
const attack={name:'Test attack',damage:40,cost:[],genericEffect:null};
assert.equal(calcDamage.call(damageContext([secondFalinks]),attackingInst,attack,defender,'player').final,60,
  'another Falinks should grant +20 attack damage');
assert.equal(calcDamage.call(damageContext([]),attackingInst,attack,defender,'player').final,40,
  'the attack bonus must not apply when no other Falinks is in play');

const damageAfterDefenses=new Function('CARD_MAP',
  `return ({${method('attackDamageAfterDefenses')}}).attackDamageAfterDefenses;`)(CARD_MAP);
const defendingFalinks={cardId:'falinks',hp:100,maxHp:100,energies:[]};
const anotherDefendingFalinks={cardId:'falinks',hp:100,maxHp:100,energies:[]};
function defenseContext(bench){
  return {
    p:{active:defendingFalinks,bench},
    o:{active:attackingInst,bench:[]},
    turn:4,
    isAttackProtected:()=>false,
    hasPokemonNamed:()=>false
  };
}
assert.equal(damageAfterDefenses.call(defenseContext([anotherDefendingFalinks]),defendingFalinks,50,'Fire',false),30,
  'another Falinks should reduce incoming attack damage by 20');
assert.equal(damageAfterDefenses.call(defenseContext([]),defendingFalinks,50,'Fire',false),50,
  'damage reduction must not apply when no other Falinks is in play');

const canPay=new Function('CARD_MAP',`return ({${method('canPay')}}).canPay;`)({
  attacker:{ability:null},
  restrictor:{ability:{genericEffect:{opponentActiveAttackCostIncrease:1,opponentActiveAttackCostType:'Water'}}}
});
const payer={cardId:'attacker',energies:['Fire'],attackCostIncrease:1,attackCostIncreaseType:'Water',attackCostIncreaseUntilTurn:4};
const temporaryCostContext={turn:4,p:{active:payer,bench:[]},o:{active:null,bench:[]}};
assert.equal(canPay.call(temporaryCostContext,payer,['Fire']),false,
  'a Water surcharge must not be paid with a Fire Energy');
assert.equal(canPay.call(temporaryCostContext,{...payer,energies:['Fire','Water']},['Fire']),true,
  'the specified Energy type should pay the temporary surcharge');
assert.equal(canPay.call({...temporaryCostContext,turn:5},payer,['Fire']),true,
  'temporary attack surcharge should expire after the opponent turn');

const passivePayer={cardId:'attacker',energies:['Fire']};
const passiveContext={turn:4,p:{active:passivePayer,bench:[]},o:{active:{cardId:'restrictor'},bench:[]}};
assert.equal(canPay.call(passiveContext,passivePayer,['Fire']),false,
  'a passive type-specific opponent surcharge should apply');
assert.equal(canPay.call(passiveContext,{...passivePayer,energies:['Fire','Water']},['Fire']),true,
  'a passive typed surcharge should require the correct Energy type');

assert.match(html,/const discardCount=Math\.max\(1,Math\.floor\(Number\(ge\.discardRandomEnergyCount\|\|ge\.discardRandomEnergy\)\|\|1\)\)/,
  'attack execution should discard the parsed number of random Energy');
assert.match(html,/attackCostIncreaseType=ge\.defendingAttackCostType\|\|'Colorless'/,
  'the next-turn attack cost effect should store its Energy type');
console.log('All added generic effect regressions passed.');
