// Pokémon Tool attachment, battle-state and regression checks.
'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');

function method(signature) {
  const start = html.indexOf(signature);
  assert.ok(start >= 0, 'missing method: ' + signature);
  const end = html.indexOf('\n      },', start);
  assert.ok(end > start, 'could not locate method end: ' + signature);
  return html.slice(start, end + 8);
}

const cards = {
  holder: {
    name: 'Grass Holder',
    category: 'Pokemon',
    type: 'Grass',
    hp: 80,
    attacks: [],
    ability: {
      passive: true,
      genericEffect: {
        passive: true,
        attackCostReductionIfToolAttached: true,
        attackCostReduction: 1,
        attackCostReductionType: 'Grass'
      }
    }
  },
  victim: { name: 'Victim', category: 'Pokemon', type: 'Water', hp: 80, pointValue: 1 },
  basicTool: { name: 'Training Tool', category: 'Trainer', subType: 'Tool' },
  otherTrainer: { name: 'Research', category: 'Trainer', subType: 'Supporter' },
  fire: { name: 'Fire Pokémon', category: 'Pokemon', type: 'Fire', hp: 80 }
};

function extract(name, signature, dependencies = []) {
  const code = method(signature);
  return new Function(...dependencies.map(x => x[0]), 'return ({' + code + '}).' + name + ';')(
    ...dependencies.map(x => x[1])
  );
}

// New Pokémon instances start without an attached Tool.
const createInst = extract('createInst', 'createInst(cardId, turnPlayed = 0)', [['CARD_MAP', cards]]);
const fresh = createInst.call({}, 'holder', 3);
assert.equal(fresh.tool, null, 'new Pokémon must have an explicit empty Tool slot');

// A valid attached Tool survives validated online board synchronization.
const normalizeRemotePokemon = extract(
  'normalizeRemotePokemon',
  'normalizeRemotePokemon(inst)',
  [['CARD_MAP', cards], ['ENERGY_TYPES', ['Grass', 'Fire', 'Water']]]
);
const remote = normalizeRemotePokemon.call({}, {
  cardId: 'holder', hp: 80, maxHp: 80, energies: ['Grass'], tool: 'basicTool',
  turnPlayed: 2, under: [], status: null, statusEffects: [], blockedAttackNames: []
});
assert.ok(remote, 'remote Pokémon with a real Tool card should be accepted');
assert.equal(remote.tool, 'basicTool', 'remote snapshot must preserve attached Tool');
assert.equal(normalizeRemotePokemon.call({}, {
  cardId: 'holder', hp: 80, maxHp: 80, energies: ['Grass'], tool: 'otherTrainer',
  turnPlayed: 2, under: [], status: null, statusEffects: [], blockedAttackNames: []
}), null, 'non-Tool Trainer must not be accepted as an attached Tool');

// Playing a Tool removes it from hand and attaches it to exactly one legal target.
const playPokemonTool = extract(
  'playPokemonTool',
  'playPokemonTool(side,hIdx,z,i)',
  [['CARD_MAP', cards], ['sound', { draw() {} }], ['getCardDisplayName', card => card?.name || 'Pokémon']]
);
const active = { cardId: 'holder', hp: 80, maxHp: 80, energies: ['Grass'], tool: null };
const bench = { cardId: 'victim', hp: 80, maxHp: 80, energies: [], tool: null };
const context = {
  p: { hand: ['basicTool'], active, bench: [bench] },
  o: { hand: [], active: null, bench: [] },
  currentSide: 'player', phase: 'play', over: false, actionLocked: false,
  isOnlineP2P: true,
  renderCalls: 0, syncCalls: 0, logs: [],
  render() { this.renderCalls++; },
  syncToPeer(passTurn) { assert.equal(passTurn, false); this.syncCalls++; },
  log(message) { this.logs.push(message); }
};
assert.equal(playPokemonTool.call(context, 'player', 0, 'active', 0), true);
assert.deepEqual(context.p.hand, [], 'used Tool leaves hand');
assert.equal(active.tool, 'basicTool', 'Tool attaches to selected Active Pokémon');
assert.equal(active.energies.length, 1, 'attaching Tool must preserve attached Energy');
assert.equal(bench.tool, null, 'unselected Bench must remain unchanged');
assert.equal(context.renderCalls, 1, 'field is rerendered after attachment');
assert.equal(context.syncCalls, 1, 'attached Tool is sent to the online peer');

// The same Pokémon cannot receive a second Tool, and a regular Trainer cannot be attached.
context.p.hand = ['basicTool'];
assert.equal(playPokemonTool.call(context, 'player', 0, 'active', 0), false,
  'one Pokémon cannot hold two Tools');
assert.deepEqual(context.p.hand, ['basicTool'], 'rejected Tool remains in hand');
context.p.hand = ['otherTrainer'];
assert.equal(playPokemonTool.call(context, 'player', 0, 'bench', 0), false,
  'Supporter cannot be attached as a Tool');
assert.deepEqual(context.p.hand, ['otherTrainer']);

// CPU may use the same attachment action on its own turn.
context.currentSide = 'opp';
context.o = { hand: ['basicTool'], active: { cardId: 'victim', hp: 80, maxHp: 80, energies: [], tool: null }, bench: [] };
assert.equal(playPokemonTool.call(context, 'opp', 0, 'active', 0), true);
assert.equal(context.o.active.tool, 'basicTool');
assert.deepEqual(context.o.hand, []);

// A Knocked Out Pokémon discards its attached Tool with its evolution stack.
const checkKO = extract(
  'checkKO',
  'checkKO(defSide, z, i, isBench = false)',
  [['CARD_MAP', cards], ['getCardDisplayName', card => card?.name || 'Pokémon']]
);
const koPokemon = { cardId: 'holder', hp: 0, maxHp: 80, energies: [], tool: 'basicTool', under: ['victim'] };
const defender = { name: 'Player', active: null, bench: [koPokemon], discard: [], points: 0 };
const attacker = { name: 'CPU', active: null, bench: [], discard: [], points: 0 };
const koContext = {
  over: false, p: defender, o: attacker, resolvingKnockoutBatch: false, resolvingAttackSide: null,
  log() {}, endMatch() {}, render() {}, openPromotionSelector() {}
};
assert.equal(checkKO.call(koContext, 'player', 'bench', 0, true), true);
assert.deepEqual(defender.discard, ['victim', 'holder', 'basicTool'],
  'Knock Out moves evolution stack, Pokémon, and attached Tool to discard');
assert.equal(defender.bench.length, 0);
assert.equal(attacker.points, 1);

// Tool-dependent ability costs use the exact required energy type.
const parseAbility = extract('parseGenericAbility', 'parseGenericAbility(text)');
const abilityContext = {
  energyMap: { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal', C: 'Colorless' }
};
const toolCostEffect = parseAbility.call(abilityContext,
  'If this Pokémon has a Pokémon Tool attached, attacks used by this Pokémon cost 1 less [G] Energy.');
assert.equal(toolCostEffect.attackCostReductionIfToolAttached, true);
assert.equal(toolCostEffect.attackCostReduction, 1);
assert.equal(toolCostEffect.attackCostReductionType, 'Grass');
const canPay = extract('canPay', 'canPay(inst, cost)', [['CARD_MAP', cards]]);
const payer = { cardId: 'holder', energies: [], tool: 'basicTool' };
const paymentContext = {
  turn: 3, p: { active: payer, bench: [] }, o: { active: null, bench: [] },
  hasPokemonNamed() { return false; }
};
assert.equal(canPay.call(paymentContext, payer, ['Grass']), true,
  'attached Tool discount removes the matching Grass requirement');
payer.tool = null;
assert.equal(canPay.call(paymentContext, payer, ['Grass']), false,
  'without the Tool the Grass requirement remains');

// Tool-dependent attack bonus and pre-damage Tool removal are parsed and ordered centrally.
const parseAttackEffect = extract('parseGenericEffect', 'parseGenericEffect(text)');
const attackContext = {
  energyMap: { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal', C: 'Colorless' },
  energyEffectType(code) { return this.energyMap[String(code || '').toUpperCase()] || null; }
};
const bonus = parseAttackEffect.call(attackContext,
  'If this Pokémon has a Pokémon Tool attached, this attack does 50 more damage.');
assert.equal(bonus.bonusIfSelfHasTool, 50);
const discardBeforeDamage = parseAttackEffect.call(attackContext,
  "Before doing damage, discard all Pokémon Tools from your opponent's Active Pokémon.");
assert.equal(discardBeforeDamage.discardOpponentActiveToolsBeforeDamage, true);
const discardIndex = html.indexOf('if(ge.discardOpponentActiveToolsBeforeDamage&&opp.active?.tool)');
const previewIndex = html.indexOf('const prev = this.calcDamagePreview(s.active, atk, opp.active, side);');
assert.ok(discardIndex >= 0 && previewIndex > discardIndex,
  'opponent Active Tool is discarded before damage is calculated');
assert.match(html, /bonusIfSelfHasTool&&attInst\.tool/);
assert.match(html, /c\.subType==='Tool'/);
assert.match(html, /どうぐをつけられるポケモンがいません/);

console.log('All Pokémon Tool attachment and lifecycle regression checks passed.');
