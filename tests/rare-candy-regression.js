// Regression checks for Rare Candy and the Genetic Apex Dragonite line.
// Run from the repository root: node tests/rare-candy-regression.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');

const start = html.indexOf('function normalizeEvolutionToken');
const end = html.indexOf('function normalizeEnergyTypes', start);
assert.ok(start >= 0 && end > start, 'evolution helpers must exist');
const helpers = new Function('CARD_MAP',
  html.slice(start, end) +
  '; return { getCardEvolutionNameAliases, isEvolutionFrom, isKnownRareCandyLine };'
)({});

const dratini = {
  id: 'catalog_A1_183', name: 'ミニリュウ', jpName: 'ミニリュウ',
  category: 'Pokemon', stage: 'Basic', setCode: 'A1'
};
const dragonite = {
  id: 'catalog_A1_185', name: 'カイリュー', jpName: 'カイリュー',
  category: 'Pokemon', stage: 'Stage2', setCode: 'A1'
};
const unrelatedBasic = {
  id: 'other-basic', name: 'ピカチュウ', jpName: 'ピカチュウ',
  category: 'Pokemon', stage: 'Basic'
};
assert.equal(helpers.isKnownRareCandyLine(dragonite, dratini), true,
  'A1 Dragonite must be playable from Dratini with Rare Candy before evolvesFrom is loaded');
assert.equal(helpers.isKnownRareCandyLine(dragonite, unrelatedBasic), false,
  'Dragonite must not be evolved from an unrelated Basic Pokemon');

assert.match(html, /async execTrainer\(side, hIdx\)/,
  'Rare Candy execution must be able to wait for supplemental gameplay data');
assert.match(html, /await Promise\.all\(setCodes\.map\(code => CARD_DATA_SUPPLEMENT\.loadSet\(code, false\)\)\)/,
  'A1 gameplay metadata must be loaded before checking Rare Candy options');
assert.match(html, /isKnownRareCandyLine\(evo, baseCard\) \|\|\s*CARDS\.some/,
  'Rare Candy menu must include the Dragonite shortcut');
assert.match(html, /isKnownRareCandyLine\(evoC, baseC\) \|\|\s*CARDS\.some/,
  'Rare Candy resolution must validate the same Dragonite shortcut');

console.log('All Rare Candy / Dragonite regression checks passed.');
