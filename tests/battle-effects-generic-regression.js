// Regression checks for generic battle-effect parsing and execution wiring.
// Run from the repository root: node tests/battle-effects-generic-regression.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');

function method(name) {
  const start = html.indexOf(name + '(');
  assert.ok(start >= 0, 'missing method: ' + name);
  const end = html.indexOf('\n      },', start);
  assert.ok(end > start, 'could not find method end: ' + name);
  return html.slice(start, end + 8);
}

const energyMap = {
  G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning',
  P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal', C: 'Colorless'
};
const parseAttack = new Function(`return ({${method('parseGenericEffect')}}).parseGenericEffect;`)();
const parseAbility = new Function(`return ({${method('parseGenericAbility')}}).parseGenericAbility;`)();
const parserContext = { energyMap };

const attackCases = [
  ["Flip a coin. If heads, the Defending Pokémon can't attack during your opponent's next turn.", 'defendingCannotAttackNextTurnIfHeads', true],
  ["Take a [Water] Energy from your Energy Zone and attach it to 1 of your Benched [Water] Pokémon.", 'attachEnergyType', 'Water'],
  ["Take a [Water] Energy from your Energy Zone and attach it to 1 of your Benched [Water] Pokémon.", 'attachEnergyTarget', 'bench'],
  ["Take a [Fire] Energy from your Energy Zone and attach it to this Pokémon.", 'attachEnergyTarget', 'self'],
  ["Move all [Psychic] Energy from this Pokémon to 1 of your Benched Pokémon.", 'moveEnergyToBench', -1],
  ["This attack also does 20 damage to 1 of your Benched Pokémon.", 'selfBenchDamageTarget', 20]
];
for (const [text, key, expected] of attackCases) {
  const parsed = parseAttack.call(parserContext, text);
  assert.ok(parsed, 'attack effect was not parsed: ' + text);
  assert.equal(parsed[key], expected, 'incorrect attack effect: ' + text);
}

const abilityCases = [
  ["Once during your turn, you may heal 20 damage from each of your Pokémon.", 'action', 'healEachOwn'],
  ["Once during your turn, you may do 20 damage to 1 of your opponent's Pokémon.", 'action', 'damageOpponentOne'],
  ["Once during your turn, you may take a [Lightning] Energy from your Energy Zone and attach it to this Pokémon.", 'energyType', 'Lightning'],
  ["Once during your turn, you may take 2 [Darkness] Energy from your Energy Zone and attach it to this Pokémon. If you do, do 30 damage to this Pokémon.", 'energyCount', 2],
  ["Once during your turn, you may take 2 [Darkness] Energy from your Energy Zone and attach it to this Pokémon. If you do, do 30 damage to this Pokémon.", 'selfDamage', 30],
  ["As often as you like during your turn, you may move a [Water] Energy from 1 of your Benched [Water] Pokémon to your Active [Water] Pokémon.", 'repeatable', true],
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
assert.match(html, /passiveDamageReductionTypes/, 'passive damage reduction is not applied');

console.log('All generic battle-effect regression checks passed.');
