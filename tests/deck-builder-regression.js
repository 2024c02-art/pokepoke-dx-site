// Deck ownership and reprint regression checks. Run: node tests/deck-builder-regression.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function getDeckCardIdentity');
const end = html.indexOf('/* v31:', start);
assert.ok(start >= 0 && end > start, 'deck identity helper must exist');
const helpers = new Function('CARD_MAP', html.slice(start, end) + '; return { getDeckCardIdentity, countDeckCardIdentity };')({
  regular: { id: 'regular', name: 'カイリュー', deckBuilderNr: 271 },
  alternate: { id: 'alternate', name: 'カイリュー', deckBuilderNr: 271 },
  different: { id: 'different', name: 'ハクリュー', deckBuilderNr: 270 }
});
assert.equal(helpers.getDeckCardIdentity('regular'), helpers.getDeckCardIdentity('alternate'));
assert.equal(helpers.countDeckCardIdentity(['regular', 'alternate'], 'regular'), 2);
assert.notEqual(helpers.getDeckCardIdentity('regular'), helpers.getDeckCardIdentity('different'));
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
  'searchCards()'
];
for (const marker of sourceChecks) assert.ok(html.includes(marker), 'missing fix: ' + marker);
console.log('All deck ownership/reprint regression checks passed.');
