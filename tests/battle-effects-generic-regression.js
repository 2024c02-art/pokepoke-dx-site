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

const abilityCases = [
  ["Once during your turn, you may heal 20 damage from each of your Pokémon.", 'action', 'healEachOwn'],
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
  ["This Pokémon takes −20 damage from attacks from [Fire] or [Water] Pokémon.", 'passiveDamageReduction', 20]
];
for (const [text, key, expected] of abilityCases) {
  const parsed = parseAbility.call(parserContext, text);
  assert.ok(parsed, 'Ability effect was not parsed: ' + text);
  assert.equal(parsed[key], expected, 'incorrect Ability effect: ' + text);
}

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

assert.match(html, /this\.resolveGenericAbility\(side,z,i\)/, 'generic Abilities are not routed to the resolver');
assert.match(html, /if\(ge\.attachEnergyFromZone>0\)/, 'Energy Zone attack effect is not applied');
assert.match(html, /if\(ge\.moveEnergyToBench&&choice/, 'attack Energy movement is not applied');
assert.match(html, /ge\.defendingCannotAttackNextTurnIfHeads&&coinHeads>0/, 'heads-only attack lock is not applied');
assert.match(html, /if\(ge\.action==='gustOpponent'&&chosen/, 'gust Ability is not resolved');
assert.match(html, /if\(ge\.action==='moveAllBenchEnergyToActive'&&chosen/, 'mass Energy movement Ability is not resolved');
assert.match(html, /discardAllEnergyType/, 'type-specific Energy discard is not resolved');
assert.match(html, /passiveDamageReductionTypes/, 'passive damage reduction is not applied');

console.log('All generic battle-effect regression checks passed.');
