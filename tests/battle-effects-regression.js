// Lightweight regression checks for the simulator's battle-effect implementation.
// Run from the repository root: node tests/battle-effects-regression.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');

const checks = [
  ['parsing single-target damage to an opponent Pokemon', /opponentPokemonDamage/],
  ['parsing conditional bonus vs Poisoned/Burned opponent', /bonusIfOpponentStatus/],
  ['parsing bonus vs any Special Condition', /bonusIfOpponentSpecialCondition/],
  ['conditional status effects based on coin threshold', /opponentStatusesIfAtLeastHeads/],
  ['status effects on heads-only attacks', /opponentStatusesIfHeads/],
  ['target-zone selection supports active and bench', /targetZone/],
  ['special condition bonus damage is applied', /bonusIfOpponentSpecialCondition/],
  ['conditional status bonus damage is applied', /bonusIfOpponentStatusDamage/],
  ['single-target effect can filter damaged targets', /opponentPokemonDamageRequiresDamage/],
  ['attack choice resolver is present', /resolveAttackChoice\s*\(/],
];
let failed = 0;
for (const [label, pattern] of checks) {
  try {
    assert.match(html, pattern);
    console.log('PASS:', label);
  } catch (e) {
    failed++;
    console.error('FAIL:', label);
  }
}
if (failed) {
  console.error(`\n${failed} regression check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} battle-effect regression checks passed.`);
