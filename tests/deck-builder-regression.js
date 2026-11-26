// Deck ownership and reprint regression checks. Run: node tests/deck-builder-regression.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function getDeckCardIdentity');
const end = html.indexOf('/* v31:', start);
assert.ok(start >= 0 && end > start, 'deck identity helper must exist');
const helpers = new Function('CARD_MAP', 'ENERGY_TYPES', html.slice(start, end) + '; return { getDeckCardIdentity, countDeckCardIdentity, isEvolutionFrom, isRareCandyCard, normalizeEnergyTypes };')({
  regular: { id: 'regular', name: 'カイリュー', deckBuilderNr: 271 },
  alternate: { id: 'alternate', name: 'カイリュー', deckBuilderNr: 271 },
  different: { id: 'different', name: 'ハクリュー', deckBuilderNr: 270 }
}, ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Colorless', 'Dragon']);
assert.equal(helpers.getDeckCardIdentity('regular'), helpers.getDeckCardIdentity('alternate'));
assert.equal(helpers.countDeckCardIdentity(['regular', 'alternate'], 'regular'), 2);
assert.notEqual(helpers.getDeckCardIdentity('regular'), helpers.getDeckCardIdentity('different'));
const dratini = { id: 'dratini', name: 'ミニリュウ', sourceNameEN: 'Dratini', category: 'Pokemon', stage: 'Basic' };
const dragonair = { id: 'dragonair', name: 'ハクリュー', sourceNameEN: 'Dragonair', evolvesFrom: 'Dragonair', enDetail: { name: 'Dragonair', evolvesFrom: 'Dratini' }, category: 'Pokemon', stage: 'Stage1' };
const dragonite = { id: 'dragonite', name: 'カイリュー', sourceNameEN: 'Dragonite', evolvesFrom: 'Dragonair', enDetail: { name: 'Dragonite', evolvesFrom: 'Dragonair' }, category: 'Pokemon', stage: 'Stage2' };
assert.equal(helpers.isEvolutionFrom(dragonair, dratini), true, 'English parent names must match Japanese Dratini card');
assert.equal(helpers.isEvolutionFrom(dragonite, dragonair), true, 'English Dragonair parent must match Japanese Dragonair card');
assert.equal(helpers.isEvolutionFrom(dragonite, dratini), false, 'Rare Candy must not skip a missing Stage 1');
assert.equal(helpers.isRareCandyCard({ id: 'catalog_A3_144', name: 'ふしぎなアメ' }), true, 'alternate Rare Candy prints must be recognized');
assert.deepEqual(helpers.normalizeEnergyTypes(['Water', 'Lightning', 'Water']), ['Water', 'Lightning']);
assert.deepEqual(helpers.normalizeEnergyTypes([]), ['Fire']);
const sourceChecks = [
  'playablePeer',
  'countsByIdentity',
  'alreadyInDeck',
  'countDeckCardIdentity(this.tempDeck, c)',
  'Object.entries(savedCollection)',
  'Defer gameplay/ownership validation',
  'Object.entries(imp.collection)',
  'validDeckShape',
  'poolLimit: 72',
  "filtered.slice(0, this.viewMode === 'dex' ? this.dexLimit : this.poolLimit)",
  'showMoreBuild()',
  'searchCards()',
  'function normalizeEvolutionToken(value)',
  'function isEvolutionFrom(evolutionCardOrId, previousCardOrId)',
  'function isRareCandyCard(cardOrId)',
  'normalizeEnergyTypes(energyTypes)',
  'isEvolutionFrom(evoC, baseC)',
  'id="lobby-deck-selector"',
  'id="battle-player-deck-label"',
  'id="battle-energy-type-pool"',
  'accountMgr.selectActiveDeck(slot, true)'
];
for (const marker of sourceChecks) assert.ok(html.includes(marker), 'missing fix: ' + marker);
console.log('All deck ownership/reprint regression checks passed.');
