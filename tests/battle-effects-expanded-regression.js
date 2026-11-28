const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');

const p=html.indexOf('parseGenericEffect(text) {');
const pe=html.indexOf('\n      },',p);
assert.ok(p>=0&&pe>p,'generic effect parser exists');
const parseMethod=html.slice(p,pe+8);
const parse=new Function(`return ({${parseMethod}}).parseGenericEffect;`)();
const ctx={
  energyMap:{G:'Grass',R:'Fire',W:'Water',L:'Lightning',P:'Psychic',F:'Fighting',D:'Darkness',M:'Metal',C:'Colorless'},
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
  ["If your opponent's Active Pokémon has a Pokémon Tool attached, this attack does 30 more damage.",'bonusIfOpponentHasTool',30],
  ["Discard a card from your hand. If you can't, this attack does nothing.",'discardHandCardOrFail',true],
  ["This attack does 40 damage for each Pokémon Tool attached to all of your Pokémon",'damagePerPokemonToolAttached',40],
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
const movedActiveEffect=parse.call(ctx,
  "If this Pokémon moved from your Bench to the Active Spot this turn, this attack does 60 more damage.");
assert.equal(movedActiveEffect.bonusIfMovedFromBenchToActive,60,
  'moved-from-Bench damage bonus should parse');
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
assert.equal(calc.call(engine,{...attacker,movedToActiveTurn:3},
  {...baseAttack,genericEffect:movedActiveEffect},def,'player').final,110,
  'moved-from-Bench bonus applies during the turn it entered the Active Spot');
assert.equal(calc.call(engine,{...attacker,movedToActiveTurn:2},
  {...baseAttack,genericEffect:movedActiveEffect},def,'player').final,50,
  'moved-from-Bench bonus expires after the turn it entered the Active Spot');
assert.equal(calc.call(engine,attacker,
  {...baseAttack,genericEffect:movedActiveEffect},def,'player').final,50,
  'a Pokémon that did not move from the Bench gets no bonus');
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusIfOpponentHasAbility:40}},def,'player').final,90,'ability bonus');
def={cardId:'targetAbility',hp:100,maxHp:100,energies:[],tool:'tool'};
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{bonusIfOpponentHasTool:30}},def,'player').final,80,
  'opponent Tool bonus requires a Tool attached to the Active Pokémon');
def={cardId:'targetAbility',hp:100,maxHp:100,energies:[]};
engine.p.active={...attacker,tool:'toolA'};
engine.p.bench=[{cardId:'attacker',tool:'toolB'},{cardId:'attacker',tool:null}];
assert.equal(calc.call(engine,attacker,{...baseAttack,genericEffect:{damagePerPokemonToolAttached:40}},def,'player').final,130,
  'damage scales with each attached Pokémon Tool across own field');
engine.p.active=null;
engine.p.bench=[];
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
assert.match(html,/movedToActiveTurn: null/,'new Pokémon instances start without a Bench-to-Active move');
assert.match(html,/bonusIfMovedFromBenchToActive/,'damage calculator supports the once-this-turn bonus');
assert.match(html,/s\.active = s\.bench\.splice\(bi, 1\)\[0\];\s*s\.active\.movedToActiveTurn = this\.turn/,'promotion records the turn');
assert.match(html,/this\.p\.active = this\.p\.bench\.splice\(bi, 1\)\[0\]; this\.p\.active\.movedToActiveTurn = this\.turn/,'retreat records the turn');
assert.match(html,/opp\.active=chosen\.inst;opp\.active\.movedToActiveTurn=this\.turn/,'opponent gust records the turn');
assert.match(html,/board\.active=chosen\.inst;board\.active\.movedToActiveTurn=this\.turn/,'own switch records the turn');
assert.match(html,/board\.active=inst;board\.active\.movedToActiveTurn=this\.turn/,'self switch records the turn');
assert.match(html,/s\.active=s\.bench\[choice\.bench\];\s*s\.active\.movedToActiveTurn=this\.turn/,'attack switch records the turn');
assert.match(html,/def\.active = def\.bench\.shift\(\);\s*def\.active\.movedToActiveTurn = this\.turn/,'automatic KO promotion records the turn');
assert.match(html,/this\.o\.active=this\.o\.bench\.shift\(\);this\.o\.active\.movedToActiveTurn=this\.turn/,'CPU batch promotion records the turn');
assert.match(html,/ge\.requiresSelfHasTool&&!inst\.tool/,'Tool-dependent Abilities validate their attached Tool');
assert.match(html,/resolveDiscardHandAttackChoice\(handCardIndex\)/,'the hand-discard attack choice has a dedicated resolver');
assert.match(html,/atk\.genericEffect\?\.discardHandCardOrFail/,'hand-discard attacks are resolved before damage');
assert.match(html,/attackStatusResolved/,'resuming an attack selection must not repeat confusion checks');
assert.match(html,/pending\.choice \|\| null/,'copied attacks preserve pre-attack resolution state');
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


const abilityParserStart=html.indexOf('parseGenericAbility(text) {');
const abilityParserEnd=html.indexOf('\n      },',abilityParserStart);
assert.ok(abilityParserStart>=0&&abilityParserEnd>abilityParserStart,'generic Ability parser exists');
const parseAbility=new Function('return ({'+html.slice(abilityParserStart,abilityParserEnd+8)+'}).parseGenericAbility;')();
const sylveonToolHeal=parseAbility.call(ctx,
  "Once during your turn, if this Pokémon has a Pokémon Tool attached, you may heal 30 damage from 1 of your Pokémon.");
assert.equal(sylveonToolHeal.action,'healOwnOne','Tool-dependent healing Ability action');
assert.equal(sylveonToolHeal.amount,30,'Tool-dependent healing amount');
assert.equal(sylveonToolHeal.requiresSelfHasTool,true,'Tool-dependent healing requires this Ability holder to have a Tool');
const arceusConditional=parseAbility.call(ctx,"Once during your turn, if you have Arceus or Arceus ex in play, you may do 30 damage to your opponent's Active Pokémon.");
assert.equal(arceusConditional.action,'damageOpponentActive','conditional Ability damage action');
assert.equal(arceusConditional.amount,30,'conditional Ability damage amount');
assert.equal(arceusConditional.requiresOwnPokemonNamed,'Arceus','conditional Ability prerequisite');
const retreatEffect=parseAbility.call(ctx,"If you have another Beldum in play, this Pokémon's Retreat Cost is 2 less.");
assert.equal(retreatEffect.retreatCostReductionIfAnotherNamedPokemonInPlay,'Beldum','named Pokémon retreat reduction target');
assert.equal(retreatEffect.retreatCostReduction,2,'named Pokémon retreat reduction amount');

const retreatCards={
  metang:{
    name:'Metang',retreat:3,
    ability:{genericEffect:retreatEffect}
  },
  beldum:{name:'Beldum',retreat:1},
  beldumWithAbility:{name:'Beldum',retreat:1,ability:{genericEffect:retreatEffect}}
};
const hasPokemonNamed=new Function('CARD_MAP','return ({'+html.slice(
  html.indexOf('hasPokemonNamed(side,name,excludeInst=null) {'),
  html.indexOf('\n      },',html.indexOf('hasPokemonNamed(side,name,excludeInst=null) {'))+8
)+'}).hasPokemonNamed;')(retreatCards);
const getEffectiveRetreatCost=new Function('CARD_MAP','return ({'+html.slice(
  html.indexOf('getEffectiveRetreatCost(side,inst) {'),
  html.indexOf('\n      },',html.indexOf('getEffectiveRetreatCost(side,inst) {'))+8
)+'}).getEffectiveRetreatCost;')(retreatCards);
const metangInstance={cardId:'metang',energies:[],retreatCostIncreaseUntilTurn:0};
const beldumInstance={cardId:'beldum',energies:[]};
const retreatContext={
  turn:3,
  p:{active:metangInstance,bench:[],retreatDiscount:0},
  o:{active:null,bench:[]},
  hasPokemonNamed(...args){return hasPokemonNamed.call(this,...args);},
  isOwnFirstTurn(){return false;}
};
assert.equal(getEffectiveRetreatCost.call(retreatContext,'player',metangInstance),3,
  'retreat cost remains unchanged without another Beldum');
retreatContext.p.bench=[beldumInstance];
assert.equal(getEffectiveRetreatCost.call(retreatContext,'player',metangInstance),1,
  'another Beldum reduces the holder retreat cost by two');
retreatContext.p.active={cardId:'beldumWithAbility',energies:[]};
retreatContext.p.bench=[];
assert.equal(getEffectiveRetreatCost.call(retreatContext,'player',retreatContext.p.active),1,
  'the Ability holder itself must not count as another Beldum');


const earlyEvolutionEffect=parseAbility.call(ctx,
  "As long as this Pokémon is in the Active Spot, it can evolve during your first turn or the turn you play it.");
assert.equal(earlyEvolutionEffect.passive,true,'early-evolution Ability remains passive');
assert.equal(earlyEvolutionEffect.allowEvolutionOnOwnFirstTurn,true,'first-turn evolution permission');
assert.equal(earlyEvolutionEffect.allowEvolutionOnTurnPlayed,true,'same-turn evolution permission');
const canEvolveStart=html.indexOf('canEvolveInstanceNow(side,inst) {');
const canEvolveEnd=html.indexOf('\n      },',canEvolveStart);
assert.ok(canEvolveStart>=0&&canEvolveEnd>canEvolveStart,'instance evolution timing helper exists');
const timingCards={rapidEvolution:{ability:{genericEffect:earlyEvolutionEffect}},ordinary:{ability:null}};
const canEvolveInstanceNow=new Function('CARD_MAP','return ({'+html.slice(canEvolveStart,canEvolveEnd+8)+'}).canEvolveInstanceNow;')(timingCards);
const rapidActive={cardId:'rapidEvolution',turnPlayed:1};
const ordinaryActive={cardId:'ordinary',turnPlayed:1};
const timingContext={
  turn:1,p:{active:rapidActive,bench:[]},o:{active:null,bench:[]},
  isOwnFirstTurn(){return true;},
  canEvolveNow(){return false;}
};
assert.equal(canEvolveInstanceNow.call(timingContext,'player',rapidActive),true,
  'Active Pokémon with the Ability may evolve during its owner first turn');
assert.equal(canEvolveInstanceNow.call(timingContext,'player',ordinaryActive),false,
  'ordinary Pokémon still cannot evolve during its owner first turn');
timingContext.p.active=null;
timingContext.p.bench=[rapidActive];
assert.equal(canEvolveInstanceNow.call(timingContext,'player',rapidActive),false,
  'the early-evolution Ability does not work from the Bench');
timingContext.turn=3;
timingContext.isOwnFirstTurn=()=>false;
timingContext.p.active={cardId:'rapidEvolution',turnPlayed:3};
assert.equal(canEvolveInstanceNow.call(timingContext,'player',timingContext.p.active),true,
  'Active Pokémon may evolve during the turn it is played');
timingContext.p.active={cardId:'ordinary',turnPlayed:2};
timingContext.canEvolveNow=()=>true;
assert.equal(canEvolveInstanceNow.call(timingContext,'player',timingContext.p.active),true,
  'ordinary evolution timing remains unchanged on a later turn');

for (const [methodName,signature] of [
  ['isPlayable','isPlayable(id) {'],
  ['playHandCard','playHandCard(idx) {'],
  ['evolveCard','evolveCard(side, hIdx, z, i, allowRareCandy = false, deferRenderAndSync = false) {'],
  ['getRareCandyOptions','getRareCandyOptions(side) {']
]) {
  const start=html.indexOf(signature);
  const end=html.indexOf('\n      },',start);
  assert.ok(start>=0&&end>start,methodName+' method exists');
  assert.match(html.slice(start,end),/canEvolveInstanceNow/,
    methodName+' must use the same per-Pokémon evolution timing rule');
}


const evolveEnergyEffect=parseAbility.call(ctx,
  "Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may take a [R] Energy from your Energy Zone and attach it to your Active [R] Pokémon.");
assert.equal(evolveEnergyEffect.trigger,'onEvolve','evolution Ability trigger');
assert.equal(evolveEnergyEffect.action,'attachEnergyOnEvolveToActiveType','evolution Energy action');
assert.equal(evolveEnergyEffect.energyType,'Fire','evolution Energy type');
assert.equal(evolveEnergyEffect.targetPokemonType,'Fire','evolution target type');
const evolutionCardMap={
  fireBasic:{name:'Emberling',category:'Pokemon',stage:'Basic',type:'Fire',hp:60},
  fireEvolved:{name:'Flarewing',category:'Pokemon',stage:'Stage1',type:'Fire',hp:100,evolvesFrom:'Emberling',ability:{genericEffect:evolveEnergyEffect}},
  waterBasic:{name:'Waterlet',category:'Pokemon',stage:'Basic',type:'Water',hp:60},
  waterEvolved:{name:'Watersaur',category:'Pokemon',stage:'Stage1',type:'Water',hp:100,evolvesFrom:'Waterlet',ability:{genericEffect:evolveEnergyEffect}}
};
const evolveStart=html.indexOf('evolveCard(side, hIdx, z, i, allowRareCandy = false, deferRenderAndSync = false) {');
const evolveEnd=html.indexOf('\n      },',evolveStart);
assert.ok(evolveStart>=0&&evolveEnd>evolveStart,'evolveCard method exists');
const evolveCard=new Function('CARD_MAP','isEvolutionFrom','isKnownRareCandyLine','CARDS','sound','battleVfx','getCardDisplayName','TYPE_META',
  'return ({'+html.slice(evolveStart,evolveEnd+8)+'}).evolveCard;')(
  evolutionCardMap,
  (evo,base)=>evo.evolvesFrom===base.name,
  ()=>false,
  [],
  {rarePull(){}},
  {triggerBurst(){}},
  card=>card?.name||'Pokémon',
  {Fire:{code:'炎'}}
);
function evolutionContext(active,bench,hand){
  const side={active,bench,hand,energyTypes:['Fire']};
  return {
    p:side,o:{active:null,bench:[]},turn:3,isOnlineP2P:false,
    canEvolveInstanceNow(_side,inst){return Number(inst.turnPlayed)<this.turn;},
    nightmareAuraCalls:[],logs:[],
    nightmareAura(_side,target,energy){this.nightmareAuraCalls.push({target,energy});return false;},
    showCutin(){},log(message){this.logs.push(message);},render(){},syncToPeer(){}
  };
}
const activeFire={cardId:'fireBasic',hp:60,maxHp:60,turnPlayed:1,energies:[],under:[]};
let evolveContext=evolutionContext(activeFire,[],['fireEvolved']);
assert.equal(evolveCard.call(evolveContext,'player',0,'active',0),true,'eligible Fire Pokémon evolves');
assert.equal(activeFire.cardId,'fireEvolved');
assert.deepEqual(activeFire.energies,['Fire'],'evolving Ability attaches Energy to the matching Active Pokémon');
assert.equal(evolveContext.nightmareAuraCalls.length,1,'Energy attachment triggers existing on-attach Ability processing');

const activeWater={cardId:'waterBasic',hp:60,maxHp:60,turnPlayed:1,energies:[],under:[]};
const benchWater={cardId:'waterBasic',hp:60,maxHp:60,turnPlayed:1,energies:[],under:[]};
evolveContext=evolutionContext(activeWater,[benchWater],['waterEvolved']);
assert.equal(evolveCard.call(evolveContext,'player',0,'bench',0),true,'eligible Water Pokémon evolves');
assert.equal(benchWater.cardId,'waterEvolved');
assert.deepEqual(activeWater.energies,[],'non-Fire Active Pokémon does not receive Fire Energy');
assert.equal(evolveContext.nightmareAuraCalls.length,0,'mismatched target type does not trigger Energy attachment');


const coinShieldEffect=parseAbility.call(ctx,
  "If any damage is done to this Pokémon by attacks, flip a coin. If heads, prevent that damage.");
assert.equal(coinShieldEffect.passive,true,'coin shield Ability is passive');
assert.equal(coinShieldEffect.flipCoinToPreventAttackDamage,true,'coin shield Ability flag');
const shieldCards={coinShield:{ability:{genericEffect:coinShieldEffect}}};
const shieldStart=html.indexOf('attackDamageAfterDefenses(inst, amount');
const shieldEnd=html.indexOf('\n      },',shieldStart);
assert.ok(shieldStart>=0&&shieldEnd>shieldStart,'attack damage defense method exists');
const attackDamageAfterDefenses=new Function('CARD_MAP',
  'return ({'+html.slice(shieldStart,shieldEnd+8)+'}).attackDamageAfterDefenses;')(shieldCards);
const shieldTarget={cardId:'coinShield',attackDamageReductionUntilTurn:0};
const shieldContext={
  turn:3,p:{active:null,bench:[shieldTarget]},o:{active:null,bench:[]},
  isAttackProtected(){return false;},hasPokemonNamed(){return false;}
};
const originalRandom=Math.random;
let coinCalls=0;
try{
  Math.random=()=>{coinCalls++;return 0.1;};
  assert.equal(attackDamageAfterDefenses.call(shieldContext,shieldTarget,50,'Fire',false),0,
    'heads prevents incoming attack damage');
  assert.equal(coinCalls,1,'positive attack damage flips one coin');
  Math.random=()=>{coinCalls++;return 0.9;};
  assert.equal(attackDamageAfterDefenses.call(shieldContext,shieldTarget,50,'Fire',false),50,
    'tails allows incoming attack damage');
  assert.equal(coinCalls,2,'each separate attack damage event flips again');
  Math.random=()=>{coinCalls++;return 0.1;};
  assert.equal(attackDamageAfterDefenses.call(shieldContext,shieldTarget,0,'Fire',false),0,
    'zero damage does not trigger the coin Ability');
  assert.equal(coinCalls,2,'zero damage does not flip a coin');
} finally {
  Math.random=originalRandom;
}

console.log('All expanded battle-effect regression checks passed.');