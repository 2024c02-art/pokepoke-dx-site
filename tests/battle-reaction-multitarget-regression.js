// Regression checks for reactive damage, Knock Out ordering, and multi-Bench attack targets.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');

function method(name){
  const start=html.indexOf('\n      '+name+'(');
  assert.ok(start>=0,'missing method: '+name);
  const end=html.indexOf('\n      },',start);
  assert.ok(end>start,'could not find method end: '+name);
  return html.slice(start,end+8);
}
const energyMap={G:'Grass',R:'Fire',W:'Water',L:'Lightning',P:'Psychic',F:'Fighting',D:'Darkness',M:'Metal',C:'Colorless'};
const parse=new Function('return ({'+method('parseGenericEffect')+'}).parseGenericEffect;')();
const parserContext={energyMap,energyEffectType(code){return energyMap[String(code||'').toUpperCase()]||null;}};
const parsed=parse.call(parserContext,"This attack also does 20 damage to up to 2 of your opponent's Benched Pokémon.");
assert.equal(parsed.benchDamage,20);
assert.equal(parsed.benchDamageCount,2);
assert.equal(parsed.benchDamageUpTo,true);

const cardMap={
  benchA:{name:'Bench A'},
  benchB:{name:'Bench B'},
  benchC:{name:'Bench C'},
  attacker:{name:'Attacker',pointValue:1},
  retaliator:{name:'Retaliator',pointValue:1,ability:{genericEffect:{counterDamageOnKnockout:30}}},
  backup:{name:'Backup',pointValue:1}
};
const applyBenchDamage=new Function('CARD_MAP','getCardDisplayName','return ({'+method('applyOpponentBenchDamage')+'}).applyOpponentBenchDamage;')(
  cardMap,card=>card?.name||'Pokémon'
);
const board={active:null,bench:[
  {cardId:'benchA',hp:50,maxHp:50,energies:[]},
  {cardId:'benchB',hp:20,maxHp:50,energies:[]},
  {cardId:'benchC',hp:50,maxHp:50,energies:[]}
]};
const damageContext={
  o:board,p:{},log(){},
  attackDamageAfterDefenses(_inst,amount){return amount;}
};
const results=applyBenchDamage.call(damageContext,'player',[1,0,1,99],20,'Fire',false);
assert.deepEqual(results.map(x=>x.index),[0,1],'multi-target selection must deduplicate and ignore invalid indexes');
assert.equal(board.bench[0].hp,30);
assert.equal(board.bench[1].hp,0,'damage should be applied individually to the second selected target');
assert.equal(board.bench[2].hp,50,'unselected Bench Pokémon must not be damaged');

// A Knocked Out Active Pokémon with counterDamageOnKnockout can KO the attacker too.
// Neither Bench should be removed by the Active KO path.
const checkKO=new Function('CARD_MAP','getCardDisplayName','return ({'+method('checkKO')+'}).checkKO;')(
  cardMap,card=>card?.name||'Pokémon'
);
const koContext={
  over:false,resolvingAttackSide:'player',turn:4,pendingSelfKO:false,isOnlineP2P:false,
  p:{active:{cardId:'attacker',hp:20,maxHp:100,under:[]},bench:[{cardId:'backup',hp:50,maxHp:50,under:[]}],discard:[],points:0,name:'Player'},
  o:{active:{cardId:'retaliator',hp:0,maxHp:100,under:[]},bench:[{cardId:'backup',hp:50,maxHp:50,under:[]}],discard:[],points:0,name:'CPU'},
  log(){},render(){},openPromotionSelector(){},endMatch(){this.over=true;}
};
checkKO.call(koContext,'opp','active',0,false);
assert.equal(koContext.p.points,1,'KO counter damage should award the defender a point for knocking out the attacker');
assert.equal(koContext.o.points,1,'the original attack KO should still award its point');
assert.equal(koContext.p.bench.length,1,'Active KO must not delete the first Bench Pokémon');
assert.equal(koContext.o.bench.length,1,'the opposing Bench remains intact after the Active KO');
assert.equal(koContext.p.active,null,'the attacker Active Pokémon should be Knocked Out');
assert.equal(koContext.o.active,koContext.o.bench[0],'the CPU should promote from its Bench after its Active is Knocked Out');

assert.match(html,/this\.checkKO\(side,'active',0\);/,'counterDamageOnAttack must invoke Active KO handling, not Bench KO handling');
assert.match(html,/resolveMultiAttackBenchChoice\(\)/,'multi-Bench UI resolver must be wired');
assert.match(html,/this\.applyOpponentBenchDamage\(side,targetIndices,genericBenchDamage/,'multi-Bench damage must use the per-target resolver');
console.log('All reactive damage and multi-target regression checks passed.');
