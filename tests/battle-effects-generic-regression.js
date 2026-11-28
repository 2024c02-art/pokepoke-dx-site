// Regression checks for generic battle-effect parsing and execution wiring.
// Run from the repository root: node tests/battle-effects-generic-regression.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');

function method(name) {
  const start = html.indexOf('\n      ' + name + '(');
  assert.ok(start >= 0, 'missing method: ' + name);
  const end = html.indexOf('\n      },', start);
  assert.ok(end > start, 'could not find method end: ' + name);
  return html.slice(start, end + 8);
}

const energyMap = {
  G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning',
  P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal', C: 'Colorless'
};
const fullEnergyMap = {
  GRASS: 'Grass', FIRE: 'Fire', WATER: 'Water', LIGHTNING: 'Lightning',
  PSYCHIC: 'Psychic', FIGHTING: 'Fighting', DARKNESS: 'Darkness',
  METAL: 'Metal', COLORLESS: 'Colorless', DRAGON: 'Dragon'
};
const parserContext = {
  energyMap,
  energyEffectType(code) {
    const key = String(code || '').trim().toUpperCase();
    return energyMap[key] || fullEnergyMap[key] || null;
  }
};
const parseAttack = new Function(`return ({${method('parseGenericEffect')}}).parseGenericEffect;`)();
const parseAbility = new Function(`return ({${method('parseGenericAbility')}}).parseGenericAbility;`)();
parserContext.parseGenericEffect = parseAttack;

const attackCases = [
  ["Flip a coin. If heads, the Defending Pokémon can't attack during your opponent's next turn.", 'defendingCannotAttackNextTurnIfHeads', true],
  ["Flip a coin for each Energy attached to this Pokémon. This attack does 50 damage for each heads.", 'coinPerEnergy', true],
  ["Flip a coin for each [Metal] Energy attached to this Pokémon. This attack does 50 damage for each heads.", 'coinPerEnergyType', 'Metal'],
  ["Discard a random Energy from among the Energy attached to all Pokémon (both yours and your opponent's).", 'discardRandomEnergyFromAll', 1],
  ["Discard 2 random Energy from among the Energy attached to all of your Pokémon.", 'discardRandomEnergyFromOwn', 2],
  ["Discard a random Energy from both Active Pokémon.", 'discardRandomEnergyFromActives', 1],
  ["This attack does 20 damage for each Energy attached to all of your opponent's Pokémon.", 'damagePerOpponentEnergyInPlay', 20],
  ["This attack does 20 damage to 1 of your opponent's Pokémon for each Energy attached to that Pokémon.", 'opponentPokemonDamagePerEnergy', 20],
  ["This attack also does 20 damage to each of your opponent's Benched Pokémon that has any Energy attached.", 'benchRequiresEnergy', true],
  ["Put 1 random [Grass] Pokémon from your deck into your hand.", 'searchDeckPokemonType', 'Grass'],
  ["Put 1 random Basic Pokémon from your deck onto your Bench.", 'searchDeckStage', 'Basic'],
  ["Discard a random card from your opponent's hand.", 'discardOpponentRandomHand', 1],
  ["Flip a coin. If heads, discard a random card from your opponent's hand.", 'coinThenDiscardOpponentRandomHand', true],
  ["Your opponent reveals a random card from their hand and shuffles it into their deck.", 'shuffleOpponentRandomHand', 1],
  ["1 of your opponent's Pokémon is chosen at random. Do 30 damage to it.", 'randomOpponentPokemonDamage', 30],
  ["Flip a coin. If tails, during your next turn, this Pokémon can't attack.", 'selfCannotAttackNextTurnIfTails', true],
  ["Take a [Water] Energy from your Energy Zone and attach it to 1 of your Benched [Water] Pokémon.", 'attachEnergyType', 'Water'],
  ["Take a [Water] Energy from your Energy Zone and attach it to 1 of your Benched [Water] Pokémon.", 'attachEnergyTarget', 'bench'],
  ["Take a [Fire] Energy from your Energy Zone and attach it to this Pokémon.", 'attachEnergyTarget', 'self'],
  ["Move all [Psychic] Energy from this Pokémon to 1 of your Benched Pokémon.", 'moveEnergyToBench', -1],
  ["This attack also does 20 damage to 1 of your Benched Pokémon.", 'selfBenchDamageTarget', 20],
  ["Discard a [Fire] Energy from this Pokémon.", 'discardEnergy', 1],
  ["Discard 2 [Psychic] Energy from this Pokémon.", 'energyType', 'Psychic'],
  ["Discard all [Water] Energy from this Pokémon.", 'discardAllEnergyType', 'Water'],
  ["This attack does 30 damage for each of your Benched [Lightning] Pokémon.", 'benchPokemonType', 'Lightning'],
  ["If this Pokémon has at least 2 extra [Water] Energy attached, this attack does 60 more damage.", 'minExtraEnergy', 2],
  ["If your opponent's Active Pokémon is a [Fighting] Pokémon, this attack does 30 more damage.", 'bonusIfOpponentType', 'Fighting'],
  ["Discard all [Water] Energy from this Pokémon. This attack also does 20 damage to 1 of your opponent's Benched Pokémon.", 'benchDamage', 20]
];
for (const [text, key, expected] of attackCases) {
  const parsed = parseAttack.call(parserContext, text);
  assert.ok(parsed, 'attack effect was not parsed: ' + text);
  assert.equal(parsed[key], expected, 'incorrect attack effect: ' + text);
}
const mixedStatusEffect = parseAttack.call(parserContext, "Flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed. If tails, your opponent's Active Pokémon is now Confused.");
assert.deepEqual(mixedStatusEffect?.opponentStatusesIfTails, ['Confused'], 'tails status should be parsed separately');

const abilityCases = [
  ["Once during your turn, you may heal 20 damage from each of your Pokémon.", 'action', 'healEachOwn'],
  ["Once during your turn, you may take a [Psychic] Energy from your Energy Zone and attach it to this Pokémon. If you use this Ability, your turn ends.", 'endsTurn', true],
  ["Once during your turn, you may put a random Pokémon from your deck into your hand.", 'action', 'searchRandomCardInDeck'],
  ["Once during your turn, you may discard the top card of your opponent's deck.", 'action', 'discardTopOpponentDeck'],
  ["Once during your turn, you may heal 30 damage from each of your [Water] Pokémon.", 'targetPokemonType', 'Water'],
  ["Once during your turn, you may do 20 damage to 1 of your opponent's Pokémon.", 'action', 'damageOpponentOne'],
  ["Once during your turn, you may do 20 damage to your opponent's Active Pokémon.", 'action', 'damageOpponentActive'],
  ["Once during your turn, you may take a [Lightning] Energy from your Energy Zone and attach it to this Pokémon.", 'energyType', 'Lightning'],
  ["Once during your turn, you may take 2 [Darkness] Energy from your Energy Zone and attach it to this Pokémon. If you do, do 30 damage to this Pokémon.", 'energyCount', 2],
  ["Once during your turn, you may take 2 [Darkness] Energy from your Energy Zone and attach it to this Pokémon. If you do, do 30 damage to this Pokémon.", 'selfDamage', 30],
  ["As often as you like during your turn, you may move a [Water] Energy from 1 of your Benched [Water] Pokémon to your Active [Water] Pokémon.", 'repeatable', true],
  ["Once during your turn, you may move all [Psychic] Energy from 1 of your Benched [Psychic] Pokémon to your Active Pokémon.", 'action', 'moveAllBenchEnergyToActive'],
  ["If this Pokémon is in the Active Spot, once during your turn, you may switch in 1 of your opponent's Benched Basic Pokémon to the Active Spot.", 'action', 'gustOpponent'],
  ["Once during your turn, if this Pokémon is in the Active Spot, you may flip a coin. If heads, your opponent's Active Pokémon is now Poisoned.", 'action', 'applyOpponentStatusIfHeads'],
  ["Once during your turn, you may flip a coin. If heads, your opponent's Active Pokémon is now Asleep.", 'action', 'applyOpponentStatusIfHeads'],
  ["Once during your turn, if this Pokémon is on your Bench, you may switch it with your Active Pokémon.", 'action', 'switchSelfFromBench'],
  ["Once during your turn, you may switch your Active [Water] Pokémon with 1 of your Benched [Water] Pokémon.", 'action', 'switchOwnActiveWithBench'],
  ["As long as this Pokémon is in the Active Spot, your opponent can't use any Supporter cards from their hand.", 'lockSupporterWhileActive', true],
  ["This Pokémon takes −20 damage from attacks from [Fire] or [Water] Pokémon.", 'passiveDamageReduction', 20],
  ["Each [Grass] Energy attached to your [Grass] Pokémon provides 2 [Grass] Energy. This effect doesn't stack.", 'energyMultiplier', 2],
  ["If this Pokémon has any Energy attached, it has no Retreat Cost.", 'retreatCostZeroIfHasEnergy', true],
  ["As long as this Pokémon is on your Bench, your Active Basic Pokémon's Retreat Cost is 1 less.", 'activeBasicRetreatCostReduction', 1],
  ["During your first turn, this Pokémon has no Retreat Cost.", 'retreatCostZeroFirstTurn', true],
  ["If this Pokémon is in the Active Spot and is damaged by an attack from your opponent's Pokémon, do 20 damage to the Attacking Pokémon.", 'counterDamageOnAttack', 20],
  ["If this Pokémon is in the Active Spot and is Knocked Out by damage from an attack from your opponent's Pokémon, do 50 damage to the Attacking Pokémon.", 'counterDamageOnKnockout', 50],
  ["This Pokémon can't be affected by any Special Conditions.", 'preventSpecialConditions', true],
  ["Whenever you attach a [Darkness] Energy from your Energy Zone to this Pokémon, do 20 damage to your opponent's Active Pokémon.", 'damageOpponentOnEnergyAttach', 20],
  ["Once during your turn, you may look at the top card of your deck.", 'action', 'lookAtTopCard'],
  ["As often as you like during your turn, you may choose 1 of your Pokémon that has damage on it, and move all of its damage to this Pokémon.", 'action', 'moveDamageToSelf']
];
for (const [text, key, expected] of abilityCases) {
  const parsed = parseAbility.call(parserContext, text);
  assert.ok(parsed, 'Ability effect was not parsed: ' + text);
  assert.equal(parsed[key], expected, 'incorrect Ability effect: ' + text);
}

const deckSearchMethod = method('resolveRandomDeckSearch');
const deckSearchCardMap = {
  grassBasic: { name: 'Bulbasaur', sourceNameEN: 'Bulbasaur', category: 'Pokemon', type: 'Grass', stage: 'Basic', hp: 70 },
  fireBasic: { name: 'Charmander', sourceNameEN: 'Charmander', category: 'Pokemon', type: 'Fire', stage: 'Basic', hp: 60 },
  grassStage1: { name: 'Ivysaur', sourceNameEN: 'Ivysaur', category: 'Pokemon', type: 'Grass', stage: 'Stage1', hp: 90 }
};
const resolveRandomDeckSearch = new Function('CARD_MAP', 'getCardDisplayName', `return ({${deckSearchMethod}}).resolveRandomDeckSearch;`)(
  deckSearchCardMap,
  card => card?.name || 'Card'
);
const deckSearchBoard = { deck: ['fireBasic', 'grassStage1', 'grassBasic'], hand: [], bench: [] };
const deckSearchContext = {
  p: deckSearchBoard, o: {}, turn: 4,
  shuffle: cards => cards,
  createInst: cardId => ({ cardId }),
  log() {},
  ui: { toast() {} }
};
assert.equal(resolveRandomDeckSearch.call(deckSearchContext, 'player', {
  searchDeckTarget: 'bench', searchDeckCategory: 'Pokemon', searchDeckPokemonType: 'Grass', searchDeckStage: 'Basic'
}, 'Test Search'), true, 'eligible random Basic Pokémon search should resolve');
assert.equal(deckSearchBoard.bench.length, 1, 'the searched Pokémon should enter the Bench');
assert.equal(deckSearchBoard.bench[0].cardId, 'grassBasic', 'search should respect both type and Stage filters');
assert.deepEqual(deckSearchBoard.deck, ['fireBasic', 'grassStage1'], 'the selected Pokémon should be removed from the deck');

const defenseSource = method('attackDamageAfterDefenses');
const cardMap = {
  fireGuard: { ability: { genericEffect: { passiveDamageReduction: 20, passiveDamageReductionTypes: ['Fire'] } } },
  generalGuard: { ability: { genericEffect: { passiveDamageReduction: 10, passiveDamageReductionTypes: [] } } }
};
const applyDefenses = new Function('CARD_MAP', `return ({${defenseSource}}).attackDamageAfterDefenses;`)(cardMap);
const fireGuard = { cardId: 'fireGuard' };
const defenseContext = {
  turn: 3, p: { active: fireGuard }, o: { active: null },
  isAttackProtected: () => false
};
assert.equal(applyDefenses.call(defenseContext, fireGuard, 50, 'Fire'), 30);
assert.equal(applyDefenses.call(defenseContext, fireGuard, 50, 'Water'), 50);
assert.equal(applyDefenses.call(defenseContext, { cardId: 'generalGuard' }, 50, 'Water'), 40);

const reactiveCardMap = {
  aura: { name: 'Aura Pokémon', ability: { name: 'Energy Aura', genericEffect: { energyType: 'Darkness', damageOpponentOnEnergyAttach: 20 } } },
  guard: { name: 'Guard Pokémon', ability: { genericEffect: { preventSpecialConditions: true } } }
};
const auraMethod = method('nightmareAura');
const runAura = new Function('CARD_MAP', 'getCardDisplayName', `return ({${auraMethod}}).nightmareAura;`)(
  reactiveCardMap, card => card.name
);
let auraChecks = 0;
const auraContext = {
  p: { active: { hp: 100 } }, o: { active: { hp: 100 } },
  showDmg() {}, log() {}, checkKO() { auraChecks++; return false; }
};
assert.equal(runAura.call(auraContext, 'player', { cardId: 'aura' }, 'Darkness'), false);
assert.equal(auraContext.o.active.hp, 80, 'Energy attachment trigger damage');
assert.equal(auraChecks, 1, 'Energy attachment trigger KO check');

const specialConditionMethod = method('applySpecialCondition');
const applyCondition = new Function('CARD_MAP', `return ({${specialConditionMethod}}).applySpecialCondition;`)(reactiveCardMap);
const immunePokemon = { cardId: 'guard', status: null, statusEffects: [] };
assert.equal(applyCondition.call({ log() {} }, immunePokemon, 'Poisoned'), false);
assert.deepEqual(immunePokemon.statusEffects, [], 'immune Pokémon must remain free of Special Conditions');

const energyCardMap = {
  grassTotem: { type: 'Grass', ability: { genericEffect: { energyMultiplier: 2, energyType: 'Grass', providedEnergyType: 'Grass', pokemonType: 'Grass' } } },
  grassActive: { type: 'Grass', stage: 'Basic', retreat: 2 },
  retreatReducer: { type: 'Colorless', ability: { genericEffect: { activeBasicRetreatCostReduction: 1 } } },
  energyRetreat: { type: 'Water', retreat: 2, ability: { genericEffect: { retreatCostZeroIfHasEnergy: true } } }
};
const canPayMethod = method('canPay');
const canPay = new Function('CARD_MAP', `return ({${canPayMethod}}).canPay;`)(energyCardMap);
const grassActive = { cardId: 'grassActive', energies: ['Grass'] };
const doubledPool = { p: { active: grassActive, bench: [{ cardId: 'grassTotem' }] }, o: { active: null, bench: [] }, turn: 3 };
assert.equal(canPay.call(doubledPool, grassActive, ['Grass', 'Grass']), true, 'one Grass Energy should provide two Grass Energy with Jungle Totem');
assert.equal(canPay.call({ p: { active: grassActive, bench: [] }, o: { active: null, bench: [] }, turn: 3 }, grassActive, ['Grass', 'Grass']), false, 'Grass Energy multiplier must not work without its Ability');

const retreatMethod = method('getEffectiveRetreatCost');
const getRetreatCost = new Function('CARD_MAP', `return ({${retreatMethod}}).getEffectiveRetreatCost;`)(energyCardMap);
const retreatContext = { p: { active: grassActive, bench: [{ cardId: 'retreatReducer' }], retreatDiscount: 0 }, o: {}, turn: 3, isOwnFirstTurn: () => false };
assert.equal(getRetreatCost.call(retreatContext, 'player', grassActive), 1, 'Benched passive should reduce Active Basic retreat cost');
assert.equal(getRetreatCost.call(retreatContext, 'player', { cardId: 'energyRetreat', energies: ['Water'] }), 0, 'attached-energy retreat Ability should make retreat free');

const koMap = {
  attacker: { pointValue: 1 },
  retaliator: { pointValue: 1, ability: { genericEffect: { counterDamageOnKnockout: 50 } } },
  backup: { pointValue: 1 }
};
const checkKOMethod = method('checkKO');
const resolveKO = new Function('CARD_MAP', 'getCardDisplayName', `return ({${checkKOMethod}}).checkKO;`)(koMap, card => card?.name || 'Pokémon');
const koContext = {
  over: false, resolvingAttackSide: 'player', turn: 3, pendingSelfKO: false, isOnlineP2P: false,
  p: { active: { cardId: 'attacker', hp: 20, maxHp: 100, under: [] }, bench: [{ cardId: 'backup', hp: 60, maxHp: 60, under: [] }], discard: [], points: 0, name: 'Player' },
  o: { active: { cardId: 'retaliator', hp: 0, maxHp: 100, under: [] }, bench: [{ cardId: 'backup', hp: 60, maxHp: 60, under: [] }], discard: [], points: 0, name: 'Opponent' },
  log() {}, render() {}, openPromotionSelector() {}, endMatch() { this.over = true; },
  checkKO(defSide, z, index, isBench) { return resolveKO.call(this, defSide, z, index, isBench); }
};
resolveKO.call(koContext, 'opp', 'active', 0, false);
assert.equal(koContext.p.points, 1, 'knocked-out Ability holder should award its point');
assert.equal(koContext.o.points, 1, 'knockout counter damage should also knock out the attacker');



assert.match(html, /this\.resolveGenericAbility\(side,z,i\)/, 'generic Abilities are not routed to the resolver');
assert.match(html, /if\(ge\.attachEnergyFromZone>0\)/, 'Energy Zone attack effect is not applied');
assert.match(html, /if\(ge\.moveEnergyToBench&&choice/, 'attack Energy movement is not applied');
assert.match(html, /ge\.defendingCannotAttackNextTurnIfHeads&&coinHeads>0/, 'heads-only attack lock is not applied');
assert.match(html, /if\(ge\.action==='gustOpponent'&&chosen/, 'gust Ability is not resolved');
assert.match(html, /if\(ge\.action==='moveAllBenchEnergyToActive'&&chosen/, 'mass Energy movement Ability is not resolved');
assert.match(html, /discardAllEnergyType/, 'type-specific Energy discard is not resolved');
assert.match(html, /passiveDamageReductionTypes/, 'passive damage reduction is not applied');
assert.match(html, /energyMultiplier>1/, 'Grass Energy multiplier is not applied to attack costs');
assert.match(html, /getEffectiveRetreatCost\('player',this\.p\.active\)/, 'passive retreat effects are not used when retreating');
assert.match(html, /knockoutAbility\?\.counterDamageOnKnockout/, 'knockout-triggered counter damage is not resolved');
assert.match(html, /preventSpecialConditions/, 'special-condition immunity is not enforced');
assert.match(html, /damageOpponentOnEnergyAttach/, 'Energy-attachment ability trigger is not resolved');
assert.match(html, /this\.nightmareAura\(side,target,energyType\)/, 'attack Energy attachments do not trigger attachment abilities');


assert.match(html, /if\(ge\.searchDeckTarget\)this\.resolveRandomDeckSearch/);
assert.match(html, /coinPerEnergy\?Math\.max/);
assert.match(html, /discardRandomEnergyFromAll/);
assert.match(html, /damagePerOpponentEnergyInPlay/);
assert.match(html, /ge\.benchRequiresEnergy/);
assert.match(html, /coinThenDiscardOpponentRandomHand/);
assert.match(html, /opponentStatusesIfTails/);
assert.match(html, /selfCannotAttackNextTurnIfTails/);
assert.match(html, /ge\.endsTurn/);
assert.match(html, /if\(this\.currentSide!=='opp'\)return/);
console.log('All generic battle-effect regression checks passed.');
