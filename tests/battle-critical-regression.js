// Critical regression checks for Knock Out zone safety and attack-effect Weakness.
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

const cardMap = {
  weak: { name: 'Weak Target', type: 'Water', weakness: 'Fire', pointValue: 1 },
  victim: { name: 'Victim', pointValue: 1 },
  attacker: { name: 'Attacker', pointValue: 1 },
  backup: { name: 'Backup', pointValue: 1 },
  playerBackup: { name: 'Player Backup', pointValue: 1 }
};
const damageMethod = new Function(
  'CARD_MAP',
  'return ({' + method('attackDamageWithActiveWeakness') + '}).attackDamageWithActiveWeakness;'
)(cardMap);
const activeTarget = { cardId: 'weak', hp: 80, maxHp: 100 };
const benchTarget = { cardId: 'weak', hp: 80, maxHp: 100 };
const damageContext = {
  p: { active: activeTarget, bench: [benchTarget] },
  o: { active: null, bench: [] },
  attackDamageAfterDefenses(_target, amount) { return Math.max(0, Number(amount) || 0); }
};
assert.deepEqual(
  damageMethod.call(damageContext, activeTarget, 30, 'Fire', false),
  { final: 50, isWeak: true },
  'Active target receives Weakness +20 for attack-effect damage'
);
assert.deepEqual(
  damageMethod.call(damageContext, benchTarget, 30, 'Fire', false),
  { final: 30, isWeak: false },
  'Benched target must not receive Weakness'
);
assert.deepEqual(
  damageMethod.call(damageContext, activeTarget, 30, 'Water', false),
  { final: 30, isWeak: false },
  'non-matching Weakness must not add damage'
);
assert.deepEqual(
  damageMethod.call(damageContext, activeTarget, 30, 'Fire', false, true),
  { final: 30, isWeak: false },
  'ignoreWeakness must suppress the bonus'
);

const resolveKO = new Function(
  'CARD_MAP',
  'getCardDisplayName',
  'return ({' + method('checkKO') + '}).checkKO;'
)(cardMap, card => card && card.name ? card.name : 'Pokémon');

function makeKOContext(pActive, pBench, oActive, oBench) {
  return {
    over: false,
    resolvingAttackSide: null,
    turn: 3,
    pendingSelfKO: false,
    isOnlineP2P: false,
    p: { active: pActive, bench: pBench, discard: [], points: 0, name: 'Player' },
    o: { active: oActive, bench: oBench, discard: [], points: 0, name: 'CPU' },
    log() {},
    render() { this.rendered = true; },
    openPromotionSelector() { this.promotionOpened = true; },
    endMatch() { this.over = true; }
  };
}

// A stale true flag must not make an Active Knock Out splice the opponent's Bench.
let context = makeKOContext(
  { cardId: 'attacker', hp: 80, maxHp: 100, under: [] },
  [{ cardId: 'playerBackup', hp: 100, maxHp: 100, under: [] }],
  { cardId: 'victim', hp: 0, maxHp: 100, under: [] },
  [{ cardId: 'backup', hp: 100, maxHp: 100, under: [] }]
);
resolveKO.call(context, 'opp', 'active', 0, true);
assert.equal(context.o.active.cardId, 'backup', 'Active Knock Out must promote the CPU Bench Pokémon');
assert.equal(context.p.bench.length, 1, 'opponent Active Knock Out must not mutate the attacker Bench');
assert.equal(context.p.points, 1, 'Active Knock Out awards the point');

// The same stale flag must not delete the player's Bench when an Active Pokémon self-KOs.
context = makeKOContext(
  { cardId: 'victim', hp: 0, maxHp: 100, under: [] },
  [{ cardId: 'playerBackup', hp: 100, maxHp: 100, under: [] }],
  { cardId: 'attacker', hp: 100, maxHp: 100, under: [] },
  []
);
resolveKO.call(context, 'player', 'active', 0, true);
assert.equal(context.p.active, null, 'self-KO must clear the Active Pokémon');
assert.equal(context.p.bench.length, 1, 'self-KO must preserve the Bench');
assert.equal(context.pendingSelfKO, true, 'self-KO must open the promotion flow');
assert.equal(context.promotionOpened, true, 'self-KO must invoke promotion selection');

// A Bench Knock Out must still remove the selected Bench Pokémon even with a false flag.
context = makeKOContext(
  { cardId: 'attacker', hp: 100, maxHp: 100, under: [] },
  [],
  { cardId: 'victim', hp: 100, maxHp: 100, under: [] },
  [{ cardId: 'victim', hp: 0, maxHp: 100, under: [] }]
);
resolveKO.call(context, 'opp', 'bench', 0, false);
assert.equal(context.o.active.cardId, 'victim', 'Bench Knock Out must not replace the Active Pokémon');
assert.equal(context.o.bench.length, 0, 'Bench Knock Out must remove its target');

assert.match(
  html,
  /this\.checkKO\(side==='player'\?'opp':'player',chosen\.z,chosen\.i,chosen\.z==='bench'\)/,
  'selected Ability damage must pass its actual target zone'
);
assert.match(
  html,
  /attackDamageWithActiveWeakness\(target\.inst,baseDamage,attC\.type,attC\.isEx,!!ge\.ignoreWeakness\)/,
  'random attack damage must calculate Weakness only for an Active target'
);
assert.match(
  html,
  /attackDamageWithActiveWeakness\(target,targetRawDamage,attC\.type,attC\.isEx,!!ge\.ignoreWeakness\)/,
  'selected attack-effect damage must calculate Active Weakness'
);
assert.match(html, /isBench = z === 'bench'/, 'KO zone must be derived from the actual target zone');

// When a reactive Ability KOs the attacker, later self-effects must not mutate
// the replacement Pokémon or dereference a cleared Active slot.
const attackMethodStart = html.indexOf('\n      attack(side, atkIdx');
const attackMethodEnd = html.indexOf('\n      },\n\n    ', attackMethodStart);
assert.ok(attackMethodStart >= 0 && attackMethodEnd > attackMethodStart, 'attack method exists');
const attackMethod = html.slice(attackMethodStart, attackMethodEnd + 8);
assert.match(attackMethod, /const attackerIsStillActive = \(\) => s\.active === attackingInst;/);
assert.match(attackMethod, /if\(attackerIsStillActive\(\)&&ge\.selfHealEqualDamageDone&&dmg>0\)/);
assert.match(attackMethod, /if\(attackerIsStillActive\(\)&&ge\.selfStatuses\)/);
assert.match(attackMethod, /if\(attackerIsStillActive\(\)&&ge\.preventAttackDamageNextTurnIfHeads/);
assert.match(attackMethod, /if\(attackerIsStillActive\(\)&&ge\.selfAttackDamageReductionNextTurn/);
assert.match(attackMethod, /if\(attackerIsStillActive\(\)&&ge\.selfCannotAttackNextTurn\)/);
assert.match(attackMethod, /if\(attackerIsStillActive\(\)&&ge\.selfCannotAttackNextTurnIfTails/);

console.log('All critical battle regression checks passed.');
