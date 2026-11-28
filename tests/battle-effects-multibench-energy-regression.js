// Regression coverage for Puppy Pile and multi-target Energy attachment.
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function method(name,signature){
  const start=html.indexOf(signature||('\n      '+name+'('));
  assert.ok(start>=0,'missing method '+name);
  const end=html.indexOf('\n      },',start);
  assert.ok(end>start,'missing method end '+name);
  return html.slice(start,end+8);
}
const supplementStart=html.indexOf('const CARD_DATA_SUPPLEMENT = {');
const supplementEnd=html.indexOf('\n    };',supplementStart);
assert.ok(supplementStart>=0&&supplementEnd>supplementStart);
const supplement=html.slice(supplementStart,supplementEnd);
const parseGenericEffect=new Function('return ({'+method('parseGenericEffect')+'}).parseGenericEffect;')();
const parserContext={
  energyMap:{W:'Water',R:'Fire',G:'Grass',L:'Lightning'},
  energyEffectType(code){return this.energyMap[String(code).toUpperCase()]||null;}
};
const attachEffect=parseGenericEffect.call(parserContext,
  'Choose 2 of your Benched Pokémon. For each of those Pokémon, take a [W] Energy from your Energy Zone and attach it to that Pokémon.');
assert.deepEqual(attachEffect,{
  attachEnergyFromZone:1,attachEnergyType:'Water',attachEnergyTarget:'multiBench',attachEnergyTargetCount:2
});
const puppyEffect=parseGenericEffect.call(parserContext,
  'Reveal all of your Pokémon in play and in your hand that have the Puppy Pile attack, and this attack does 20 damage for each Pokémon you revealed in this way.');
assert.equal(puppyEffect?.bonusPerPuppyPilePokemon,20);

const CARD_MAP={
  puppyActive:{type:'Water',isEx:false,weakness:'None',attacks:[{name:'Puppy Pile',damage:10,cost:[]}]},
  puppyBench:{type:'Water',isEx:false,weakness:'None',attacks:[{name:'Puppy Pile',damage:10,cost:[]}]},
  puppyHand:{type:'Water',isEx:false,weakness:'None',attacks:[{name:'Puppy Pile',damage:10,cost:[]}]},
  defender:{type:'Colorless',isEx:false,weakness:'None',retreat:1,attacks:[]}
};
const calcDamage=new Function('CARD_MAP',
  'return ({'+method('calcDamagePreview')+'}).calcDamagePreview;')(CARD_MAP);
const active={cardId:'puppyActive',hp:100,maxHp:100,energies:[],statusEffects:[]};
const bench={cardId:'puppyBench',hp:100,maxHp:100,energies:[],statusEffects:[]};
const defender={cardId:'defender',hp:100,maxHp:100,energies:[],statusEffects:[]};
const damageContext={
  turn:3,
  p:{active,bench:[bench],hand:['puppyHand'],discard:[],points:0,dmgBonus:0},
  o:{active:defender,bench:[],discard:[],points:0},
  hasPokemonNamed(){return false;},
  energyEffectType(value){return value;},
  attackDamageAfterDefenses(_target,damage){return damage;},
  isAttackProtected(){return false;}
};
const damage=calcDamage.call(damageContext,active,{
  name:'Puppy Pile',damage:10,cost:[],genericEffect:puppyEffect
},defender,'player');
assert.equal(damage.final,70,'active + bench + hand Puppy Pile Pokémon each add 20 damage');

const selectedInputs=[{getAttribute(){return '1';}},{getAttribute(){return '2';}}];
const fakeDocument={querySelectorAll(){return selectedInputs;}};
const resolveMulti=new Function('document',
  'return ({'+method('resolveMultiAttackBenchChoice')+'}).resolveMultiAttackBenchChoice;')(fakeDocument);
const p={bench:[{cardId:'one'},{cardId:'two'},{cardId:'three'}]};
const o={bench:[{cardId:'enemy'}]};
const ctx={
  sessionId:9,
  pendingAttackChoice:{session:9,side:'player',atkIdx:0,copiedAttackIdx:null,multiBench:true,maxTargets:2,requiredTargets:2,targetSide:'self'},
  p,o,actionLocked:true,render(){this.rendered=true;},
  attack(...args){this.attackArgs=args;}
};
resolveMulti.call(ctx);
assert.deepEqual(ctx.attackArgs,['player',0,null,{benches:[1,2],targetSide:'self'}],
  'multi-select must return indexes on the own Bench for own Energy effects');
assert.equal(ctx.pendingAttackChoice,null);
assert.equal(ctx.actionLocked,false);
assert.equal(ctx.rendered,true);

const attack=method('attack','\n      attack(side, atkIdx, copiedAttackIdx = null, choice = null) {');
assert.match(attack,/attachEnergyTarget==='multiBench'/);
assert.match(attack,/choice\?\.targetSide==='self'/);
assert.match(attack,/choice\.benches\|\|\[\]/);
console.log('All Puppy Pile and multi-bench Energy regression checks passed.');
