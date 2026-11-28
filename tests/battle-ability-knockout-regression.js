// Runtime regression checks for Ability damage and self-Knock Out target zones.
'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');

function method(name, signature) {
  const start = html.indexOf(signature || ('\n      ' + name + '('));
  assert.ok(start >= 0, 'missing method: ' + name);
  const end = html.indexOf('\n      },', start);
  assert.ok(end > start, 'could not find method end: ' + name);
  return html.slice(start, end + 8);
}

const cardMap = {
  abilityActive: {
    name: 'Active Ability',
    pointValue: 1,
    ability: { name: 'Active Strike', genericEffect: { action: 'damageOpponentActive', amount: 30 } }
  },
  abilitySelected: {
    name: 'Selected Ability',
    pointValue: 1,
    ability: { name: 'Target Strike', genericEffect: { action: 'damageOpponentOne', amount: 30 } }
  },
  abilityRequiresArceus: {
    name: 'Conditional Ability',
    pointValue: 1,
    ability: { name: 'Arceus Pulse', genericEffect: { action: 'damageOpponentActive', amount: 30, requiresOwnPokemonNamed: 'Arceus' } }
  },
  arceus: { name: 'Arceus', pointValue: 1 },
  arceusEx: { name: 'Arceus ex', pointValue: 2 },
  abilitySelf: {
    name: 'Self Damage Ability',
    pointValue: 1,
    ability: { name: 'Overload', genericEffect: { action: 'attachEnergySelf', energyType: 'Fire', energyCount: 1, selfDamage: 30 } }
  },
  victim: { name: 'Victim', pointValue: 1, type: 'Water', weakness: 'Fire' },
  benchVictim: { name: 'Bench Victim', pointValue: 1, type: 'Water', weakness: 'Fire' },
  playerBackup: { name: 'Player Backup', pointValue: 1 },
  cpuBackup: { name: 'CPU Backup', pointValue: 1 },
  cpuActive: { name: 'CPU Active', pointValue: 1 }
};

const resolveAbility = new Function(
  'CARD_MAP', 'getCardDisplayName', 'ui', 'sound', 'battleVfx', 'TYPE_META',
  'return ({' + method('resolveGenericAbility') + '}).resolveGenericAbility;'
)(
  cardMap,
  card => card?.name || 'Pokémon',
  { toast() {} },
  { energy() {} },
  { triggerBurst() {} },
  { Fire: { code: '炎', c1: '#f97316' } }
);
const hasPokemonNamed = new Function(
  'CARD_MAP',
  'return ({' + method('hasPokemonNamed', 'hasPokemonNamed(side,name,excludeInst=null) {') + '}).hasPokemonNamed;'
)(cardMap);
const checkKO = new Function(
  'CARD_MAP', 'getCardDisplayName',
  'return ({' + method('checkKO') + '}).checkKO;'
)(cardMap, card => card?.name || 'Pokémon');

function pokemon(cardId, hp = 100) {
  return { cardId, hp, maxHp: 100, under: [], energies: [], abilityUsed: false };
}

function makeContext(pActive, pBench, oActive, oBench) {
  return {
    over: false,
    actionLocked: false,
    phase: 'play',
    currentSide: 'player',
    turn: 3,
    pendingSelfKO: false,
    pendingPromotionNext: null,
    isOnlineP2P: false,
    p: { active: pActive, bench: pBench, discard: [], points: 0, name: 'Player', energyTypes: ['Fire'], hand: [], deck: [] },
    o: { active: oActive, bench: oBench, discard: [], points: 0, name: 'CPU', energyTypes: ['Fire'], hand: [], deck: [] },
    log() {},
    render() {},
    openPromotionSelector() { this.promotionOpened = true; },
    endMatch(winner) { this.over = true; this.winner = winner; },
    checkKO(...args) { return checkKO.call(this, ...args); },
    nightmareAura() { return false; },
    syncToPeer() {}
  };
}

// 1. A trait that damages the opponent's Active Pokémon must use Active KO handling.
let context = makeContext(
  pokemon('abilityActive'),
  [pokemon('playerBackup')],
  pokemon('victim', 30),
  [pokemon('cpuBackup')]
);
assert.equal(resolveAbility.call(context, 'player', 'active', 0), true);
assert.equal(context.o.active.cardId, 'cpuBackup', 'Ability KO must promote the opponent Bench');
assert.equal(context.o.bench.length, 0, 'promoted Pokémon must be removed from Bench');
assert.equal(context.o.discard.includes('victim'), true, 'Ability KO must discard the original Active');
assert.equal(context.p.points, 1, 'Ability KO must award the point to the Ability user');
assert.equal(context.p.bench.length, 1, 'the Ability KO must not mutate the Ability user Bench');

// 2. A selected Ability target may be the opponent Active Pokémon.
context = makeContext(
  pokemon('abilitySelected'),
  [],
  pokemon('victim', 30),
  [pokemon('cpuBackup')]
);
assert.equal(resolveAbility.call(context, 'player', 'active', 0, 'active', 0), true);
assert.equal(context.o.active.cardId, 'cpuBackup', 'selected Active KO must use Active promotion');
assert.equal(context.o.discard.includes('victim'), true);
assert.equal(context.p.points, 1);

// 3. A selected Ability target may be a Bench Pokémon; the Active must remain untouched.
const originalCpuActive = pokemon('cpuActive', 100);
context = makeContext(
  pokemon('abilitySelected'),
  [],
  originalCpuActive,
  [pokemon('benchVictim', 30), pokemon('cpuBackup')]
);
assert.equal(resolveAbility.call(context, 'player', 'active', 0, 'bench', 0), true);
assert.equal(context.o.active, originalCpuActive, 'Bench KO must not replace or clear the opponent Active');
assert.deepEqual(context.o.bench.map(item => item.cardId), ['cpuBackup'], 'only the selected Bench target must be removed');
assert.equal(context.o.discard.includes('benchVictim'), true);
assert.equal(context.p.points, 1);

// 4. Self-damage from an Ability must pass the source Pokémon's actual zone to checkKO.
context = makeContext(
  pokemon('abilitySelf', 20),
  [pokemon('playerBackup')],
  pokemon('cpuActive'),
  []
);
assert.equal(resolveAbility.call(context, 'player', 'active', 0), true);
assert.equal(context.p.active, null, 'self-KO must clear the original Active');
assert.equal(context.p.bench.length, 1, 'self-KO must preserve the remaining Bench');
assert.equal(context.promotionOpened, true, 'self-KO must open the promotion selector');
assert.equal(context.pendingSelfKO, true, 'self-KO must pause the match for promotion');
assert.equal(context.o.points, 1, 'opponent must receive the point for the self-KO');
assert.equal(context.p.discard.includes('abilitySelf'), true);

// 5. The same self-damage action on the Bench must remove only the selected Bench Pokémon.
context = makeContext(
  pokemon('playerBackup'),
  [pokemon('abilitySelf', 20), pokemon('cpuBackup')],
  pokemon('cpuActive'),
  []
);
assert.equal(resolveAbility.call(context, 'player', 'bench', 0), true);
assert.equal(context.p.active.cardId, 'playerBackup', 'Bench self-KO must preserve the Active');
assert.deepEqual(context.p.bench.map(item => item.cardId), ['cpuBackup'], 'Bench self-KO must remove only its source');
assert.equal(context.o.points, 1);
assert.equal(context.p.discard.includes('abilitySelf'), true);

// 6. Conditional Active-damage Abilities must check for Arceus or Arceus ex in play.
let conditionalTarget=pokemon('victim',100);
context=makeContext(pokemon('abilityRequiresArceus'),[],conditionalTarget,[]);
context.hasPokemonNamed=(side,name)=>hasPokemonNamed.call(context,side,name);
assert.equal(resolveAbility.call(context,'player','active',0),false,
  'conditional Ability must not be usable without Arceus');
assert.equal(conditionalTarget.hp,100,'failed prerequisite must not deal damage');

conditionalTarget=pokemon('victim',100);
context=makeContext(pokemon('abilityRequiresArceus'),[pokemon('arceusEx')],conditionalTarget,[]);
context.hasPokemonNamed=(side,name)=>hasPokemonNamed.call(context,side,name);
assert.equal(resolveAbility.call(context,'player','active',0),true,
  'Arceus ex also satisfies the Arceus prerequisite');
assert.equal(conditionalTarget.hp,70,'conditional Ability deals its printed damage when enabled');

console.log('All Ability damage and self-Knock Out runtime regression checks passed.');
