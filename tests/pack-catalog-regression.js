// Regression checks for the normal expansion pack catalogue.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('const PACKS = [');
const end = html.indexOf('\n    ];', start);
assert.ok(start >= 0 && end > start, 'the main PACKS array exists');
const ids = [...html.slice(start,end).matchAll(/\{\s*id:\s*'([^']+)'/g)].map(match=>match[1]);
assert.equal(ids.length, 31, 'the main expansion catalogue must have 31 booster pack entries');
assert.equal(new Set(ids).size, ids.length, 'pack IDs must be unique');
assert.match(html,/ALL 31 PACKS/,'the pack-screen badge must reflect the actual pack array');
assert.match(html,/公式全31パック収録/,'the home-screen label must reflect the actual pack array');
assert.match(html,/全31種類/,'the pack-screen heading must reflect the actual pack array');
assert.match(html,/b4b_mega:\{setTotal:429,packTotal:429,coverage:'complete',nameLanguage:'mixed'\}/,'B4b catalog metadata must be present');
assert.match(html,/if\(code==='b4b'\)\{\s*PACK_CATALOG_DATA\.b4b_mega=/,'B4b card catalogue must be materialized from the current set shard');
console.log('All expansion pack catalogue regression checks passed.');
