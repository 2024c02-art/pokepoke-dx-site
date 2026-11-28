// Regression coverage for Bench attack protection and multi-type team damage bonuses.
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

const benchShield=parse.call(parserContext,'As long as this Pokémon is on your Bench, prevent all damage done to this Pokémon by attacks.');
assert.equal(benchShield?.passive,true);
assert.equal(benchShield?.preventDamageWhileBenched,true);

const teamBoost=parse.call(parserContext,"Attacks used by your [P] Pokémon and [M] Pokémon do +30 damage to your opponent's Active Pokémon.");
assert.equal(teamBoost?.passive,true);
assert.deepEqual(teamBoost?.passiveAttackDamageBonusTypes,['Psychic','Metal']);
assert.equal(teamBoost?.passiveAttackDamageBonus,30);

const CARD_MAP={
  shield:{name:'Bench Shield',category:'Pokemon',ability:{genericEffect:benchShield}},
  boost:{name:'Team Booster',category:'Pokemon',ability:{genericEffect:teamBoost}},
  attackerPsychic:{name:'Psychic Attacker',category:'Pokemon',type:'Psychic',weakness:'None',retreat:1},
  attackerMetal:{name:'Metal Attacker',category:'Pokemon',type:'Metal',weakness:'None',retreat:1},
  attackerFire:{name:'Fire Attacker',category:'Pokemon',type:'Fire',weakness:'None',retreat:1},
  defender:{name:'Defender',category:'Pokemon',type:'Water',weakness:'None',retreat:1},
};
const defense=new Function('CARD_MAP','return ({'+method('attackDamageAfterDefenses')+'}).attackDamageAfterDefenses;')(CARD_MAP);
const calc=new Function('CARD_MAP','return ({'+method('calcDamagePreview')+'}).calcDamagePreview;')(CARD_MAP);

function pokemon(cardId,hp=100){return {cardId,hp,maxHp:100,energies:[],statusEffects:[]};}
function damageContext(attacker,boosters,defender){
  const p={active:attacker,bench:boosters,dmgBonus:0,hand:[],discard:[],points:0};
  const o={active:defender,bench:[],points:0};
  return {
    p,o,turn:3,
    isAttackProtected(){return false;},
    hasPokemonNamed(){return false;},
    energyEffectType(value){return typeMap[String(value||'').toUpperCase()]||null;},
    attackDamageAfterDefenses(inst,amount,type,isEx){return defense.call(this,inst,amount,type,isEx);}
  };
}

// A Bench-only shield blocks attack damage to that exact Pokémon, but not while it is Active.
let shielded=pokemon('shield');
let normalAttacker=pokemon('attackerFire');
let ctx=damageContext(normalAttacker,[],pokemon('defender'));
ctx.p.bench=[shielded];
assert.equal(defense.call(ctx,shielded,40,'Fire',false),0,'Bench shield must prevent all attack damage to its holder');
ctx.p.active=shielded;
ctx.p.bench=[];
assert.equal(defense.call(ctx,shielded,40,'Fire',false),40,'Bench-only shield must stop applying after the Pokémon becomes Active');

// A dual-type team Ability adds its bonus to both named types and not to unrelated types.
const booster=pokemon('boost');
const defender=pokemon('defender');
function preview(attackerId){
  const attacker=pokemon(attackerId);
  const board=damageContext(attacker,[booster],defender);
  return calc.call(board,attacker,{name:'Test Attack',damage:40,cost:[],genericEffect:null},defender,'player').final;
}
assert.equal(preview('attackerPsychic'),70,'Psychic attackers receive the team bonus');
assert.equal(preview('attackerMetal'),70,'Metal attackers receive the team bonus');
assert.equal(preview('attackerFire'),40,'unlisted types must not receive the team bonus');

console.log('All Bench defense and multi-type team damage regressions passed.');
