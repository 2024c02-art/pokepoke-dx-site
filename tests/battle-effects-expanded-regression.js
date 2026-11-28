const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');

const p=html.indexOf('parseGenericEffect(text) {');
const pe=html.indexOf('\n      },',p);
assert.ok(p>=0&&pe>p,'generic effect parser exists');
const parseMethod=html.slice(p,pe+8);
const parse=new Function(`return ({${parseMethod}}).parseGenericEffect;`)();
const ctx={
  energyMap:{G:'Grass',R:'Fire',W:'Water',L:'Lightning',P:'Psychic',F:'Fighting',D:'Darkness',M:'Metal'},
  energyEffectType(code){
    const key=String(code||'').trim().toUpperCase();
    return this.energyMap[key]||({GRASS:'Grass',FIRE:'Fire',WATER:'Water',LIGHTNING:'Lightning',PSYCHIC:'Psychic',FIGHTING:'Fighting',DARKNESS:'Darkness',METAL:'Metal',COLORLESS:'Colorless',DRAGON:'Dragon'})[key]||null;
  }
};
const cases=[
  ["During your opponent's next turn, attacks used by the Defending Pokémon do −20 damage.",'defendingAttackDamageReductionNextTurn',20],
  ["During your opponent's next turn, the Defending Pokémon can't attack.",'defendingCannotAttackNextTurn',true],
  ["If the Defending Pokémon is a Basic Pokémon, it can't attack during your opponent's next turn.",'defendingCannotAttackNextTurnIfBasic',true],
  ["During your opponent's next turn, if the Defending Pokémon tries to use an attack, your opponent flips a coin. If tails, that attack doesn't happen.",'defendingAttackFailureOnTailsNextTurn',true],
  ["During your opponent's next turn, attacks used by the Defending Pokémon cost 1 more, and its Retreat Cost is 1 more.", "defendingAttackCostIncreaseNextTurn", 1],
  ["During your opponent's next turn, they can't play any Item cards from their hand.",'opponentItemLockNextTurn',true],
  ["During your opponent's next turn, they can't play any Trainer cards from their hand.",'opponentTrainerLockNextTurn',true],
  ["If your opponent's Active Pokémon has an Ability, this attack does 40 more damage.",'bonusIfOpponentHasAbility',40],
  ["If you played a Supporter card from your hand during this turn, this attack does 50 more damage.",'bonusIfSupporterPlayedThisTurn',50],
  ["If the Defending Pokémon is a Basic Pokémon, this attack does 30 more damage.",'bonusIfOpponentIsBasic',30],
  ["If 1 of your Pokémon used Sweets Relay during your last turn, this attack does 20 more damage.",'bonusIfSweetsRelayLastTurn',20],
  ["This attack does 40 damage for each time your Pokémon used Sweets Relay during this game.",'bonusPerSweetsRelayUsedThisGame',40],
  ["If any of your Pokémon were Knocked Out by damage from an attack during your opponent's last turn, this attack does 60 more damage.",'bonusIfPokemonKnockedOutLastTurn',60],
  ["If any of your [D] Pokémon were Knocked Out by damage from an attack during your opponent's last turn, this attack does 80 more damage.",'bonusIfPokemonTypeKnockedOutLastTurn','Darkness'],
["If your opponent's Active Pokémon is Confused, this attack does 40 more damage.","bonusIfOpponentStatus","confused"],
["This attack does 20 more damage for each Pokémon in your discard pile.","bonusPerDiscardedPokemon",20],
["This attack does 20 more damage for each [P] Pokémon in your discard pile.","bonusPerDiscardedPokemonType",20],
["This attack does 20 more damage for each Supporter card in your discard pile.","bonusPerDiscardedSupporter",20],
["This attack does 10 more damage for each Item card in your discard pile.","bonusPerDiscardedItem",10],
["Heal 20 damage from each of your Pokémon.","healEachOwnPokemon",20],
["This Pokémon recovers from all Special Conditions.","selfClearSpecialConditions",true],
["Heal from this Pokémon the same amount of damage you did to your opponent's Active Pokémon.","selfHealEqualDamageDone",true],
["During your next turn, this Pokémon can't use Frenzy Plant.","selfCannotUseAttackNextTurn","Frenzy Plant"]
];
for(const [text,key,expected] of cases){const parsed=parse.call(ctx,text);assert.ok(parsed,'unparsed effect: '+text);assert.equal(parsed[key],expected,'wrong parsed value: '+text);}
const psychicDiscardEffect=parse.call(ctx,"This attack does 20 more damage for each [P] Pokémon in your discard pile.");
assert.equal(psychicDiscardEffect.discardedPokemonType,'Psychic','discarded Pokemon type');

const calcStart=html.indexOf('calcDamagePreview(attInst, atk, defInst, side) {');
const calcEnd=html.indexOf('\n      resolveMoltresAbility',calcStart);
assert.ok(calcStart>=0&&calcEnd>calcStart,'damage calculator exists');
const calcSource=html.slice(calcStart,calcEnd);
const calc=new Function('CARD_MAP',`return ({${calcSource}}).calcDamagePreview;`)({
  attacker:{type:'Fire',weakness:'None'},
  targetAbility:{type:'Water',weakness:'None',stage:'Stage1',ability:{name:'Test Ability'}},
  targetBasic:{type:'Water',weakness:'None',stage:'Basic',ability:null},
  grassDiscard:{category:'Pokemon',type:'Grass'},
  psychicDiscard:{category:'Pokemon',type:'Psychic'},
  supporterDiscard:{category:'Trainer',subType:'Supporter'},
  itemDiscard:{category:'Trainer',subType:'Item'}
});
const engine={
  p:{points:0,supporterUsed:false,dmgBonus:0,bench:[],discard:['grassDiscard','psychicDiscard','supporterDiscard','itemDiscard'],lastKOByOpponentAttack:{turn:-1,types:[]},sweetsRelayUsedTurn:-1,sweetsRelayUses:0},
  o:{points:0,active:{energies:[]},bench:[]},
  turn:3,
  energyEffectType:code=>ctx.energyMap[String(code||'').toUpperCase()]||null,
  isAttackProtected:()=>false,
  attackDamageAfterDefenses:(_inst,amount)=>Math.max(0,amount)
};
const attacker={cardId:'attacker',hp:100,maxHp:100,energies:[],attackDamagePenalty:0,attackDamagePenaltyUntilTurn:0};
const baseAttack={name:'Base',damage:50,cost:[],genericEffect:null};
let def={cardId:'targetAbility',hp:100,maxHp:100,energies:[]};
engine.calcDamagePreview=calc;
engine.p.supporterUsed=false;
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusIfOpponentHasAbility:40}},def,'player').final,90,'ability bonus');
engine.p.supporterUsed=true;
assert.equal(calc.call(engine,{...attacker},{...baseAttack,genericEffect:{bonusIfSupporterPlayedThisTurn:50}},def,'player').final,100,'supporter bonus');
engine.p.supporterUsed=false;
def={cardId:'targetBasic',hp:100,maxHp:100,energies:[]};
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusIfOpponentIsBasic:30}},def,'player').final,80,'Basic target bonus');
engine.p.sweetsRelayUsedTurn=1;
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusIfSweetsRelayLastTurn:20}},def,'player').final,70,'Sweets Relay last-turn bonus');
engine.p.sweetsRelayUses=3;
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusPerSweetsRelayUsedThisGame:40}},def,'player').final,170,'Sweets Relay cumulative bonus');
engine.p.lastKOByOpponentAttack={turn:2,types:['Darkness']};
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusIfPokemonKnockedOutLastTurn:60}},def,'player').final,110,'KO last-turn bonus');
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusIfPokemonTypeKnockedOutLastTurn:'Darkness',bonusIfPokemonTypeKnockedOutLastTurnDamage:80}},def,'player').final,130,'typed KO last-turn bonus');
attacker.attackDamagePenalty=20;attacker.attackDamagePenaltyUntilTurn=3;
assert.equal(calc.call(engine,attacker,baseAttack,def,'player').final,30,'temporary outgoing attack damage reduction');
attacker.attackDamagePenalty=0;attacker.attackDamagePenaltyUntilTurn=0;
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusPerDiscardedPokemon:10}},def,'player').final,70,'discarded Pokemon bonus');
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusPerDiscardedPokemonType:15,discardedPokemonType:'Psychic'}},def,'player').final,65,'discarded type bonus');
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusPerDiscardedSupporter:20}},def,'player').final,70,'discarded Supporter bonus');
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusPerDiscardedItem:10}},def,'player').final,60,'discarded Item bonus');
assert.match(html,/opponentItemLockNextTurn/);
assert.match(html,/c\.subType!=='Supporter' && Number\(s\.itemBlockedUntilTurn\|\|0\)>=this\.turn/);
assert.match(html,/c\.subType!=='Supporter'&&Number\(this\.p\.itemBlockedUntilTurn\|\|0\)>=this\.turn/);
assert.match(html,/itemBlockedUntilTurn: Number\(this\.p\.itemBlockedUntilTurn\|\|0\)/);
assert.match(html,/trainerBlockedUntilTurn: Number\(this\.p\.trainerBlockedUntilTurn\|\|0\)/);
assert.match(html,/attackDamagePenaltyUntilTurn/);
assert.match(html,/opponentTrainerLockNextTurn/);
assert.match(html,/attackFailureOnTailsUntilTurn/);
assert.match(html,/attackNameBlockUntilTurn/);
assert.match(html,/healEachOwnPokemon/);
assert.match(html,/selfClearSpecialConditions/);
assert.match(html,/selfHealEqualDamageDone/);
assert.match(html,/blockedAttackNames/);
assert.match(html,/lastKOByOpponentAttack/);
assert.match(html,/sweetsRelayUsedTurn/);
const costEffect=parse.call(ctx,"During your opponent's next turn, attacks used by the Defending Pokémon cost 1 more, and its Retreat Cost is 1 more.");
const typedCostEffect=parse.call(ctx,"During your opponent's next turn, attacks used by the Defending Pokémon cost 1 [C] more.");
assert.equal(typedCostEffect.defendingAttackCostIncreaseNextTurn,1,'typed attack-cost increase amount');
assert.equal(typedCostEffect.defendingAttackCostType,'Colorless','typed attack-cost increase energy type');
assert.equal(costEffect.defendingRetreatCostIncreaseNextTurn,1,'retreat cost increase parser');
const payStart=html.indexOf('canPay(inst, cost) {');
const payEnd=html.indexOf('\n      },',payStart);
assert.ok(payStart>=0&&payEnd>payStart,'energy payment checker exists');
const payMethod=html.slice(payStart,payEnd+8);
const canPay=new Function('CARD_MAP','return ({'+payMethod+'}).canPay;')({});
const payer={energies:['Fire'],attackCostIncrease:1,attackCostIncreaseUntilTurn:4};
assert.equal(canPay.call({turn:4},payer,['Fire']),false,'next-turn cost increase enforced');
assert.equal(canPay.call({turn:5},payer,['Fire']),true,'cost increase expires');
assert.match(html,/retreatCostIncreaseUntilTurn/);
assert.match(html,/attackCostIncreaseUntilTurn/);
assert.match(html,/defendingAttackCostIncreaseNextTurn/);
assert.match(html,/defendingRetreatCostIncreaseNextTurn/);

console.log('All expanded battle-effect regression checks passed.');