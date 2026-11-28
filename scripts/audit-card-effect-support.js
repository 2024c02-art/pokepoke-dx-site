#!/usr/bin/env node
'use strict';

// Audit every gameplay shard against the parser shipped in index.html.
// Results are review candidates, not proof of unsupported cards: card-specific
// handlers may already implement some effects outside the generic parsers.

const fs = require('node:fs');
const path = require('node:path');

const BASE = 'https://raw.githubusercontent.com/PocketDecks/pokemon-tcg-pocket-cards/main/data/v5';
const CONCURRENCY = 3;
const ENERGY_MAP = {
  G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic',
  F: 'Fighting', D: 'Darkness', M: 'Metal', C: 'Colorless'
};
const FULL_ENERGY_MAP = {
  grass: 'Grass', fire: 'Fire', water: 'Water', lightning: 'Lightning',
  psychic: 'Psychic', fighting: 'Fighting', darkness: 'Darkness',
  metal: 'Metal', colorless: 'Colorless', dragon: 'Dragon'
};

function extractMethod(source, methodName) {
  const start = source.indexOf('\n      ' + methodName + '(');
  if (start < 0) throw new Error('Could not find parser method: ' + methodName);
  const end = source.indexOf('\n      },', start);
  if (end < 0) throw new Error('Could not find end of parser method: ' + methodName);
  return source.slice(start + 7, end + 8);
}

function loadParsers(html) {
  const start = html.indexOf('const CARD_DATA_SUPPLEMENT = {');
  if (start < 0) throw new Error('CARD_DATA_SUPPLEMENT not found in index.html');
  const end = html.indexOf('\n    };', start);
  if (end < 0) throw new Error('CARD_DATA_SUPPLEMENT end not found');
  const objectSource = html.slice(start, end);
  const parseGenericEffect = new Function('return ({' +
    extractMethod(objectSource, 'parseGenericEffect') + '}).parseGenericEffect;')();
  const parseGenericAbility = new Function('return ({' +
    extractMethod(objectSource, 'parseGenericAbility') + '}).parseGenericAbility;')();

  const context = {
    energyMap: ENERGY_MAP,
    energyEffectType(value) {
      const raw = String(value || '').trim();
      return ENERGY_MAP[raw.toUpperCase()] || FULL_ENERGY_MAP[raw.toLowerCase()] || null;
    },
    parseGenericEffect
  };
  return {
    attack: text => parseGenericEffect.call(context, text),
    ability: text => parseGenericAbility.call(context, text)
  };
}

function getSetCodes(html) {
  const start = html.indexOf('const PACKS = [');
  const end = html.indexOf('\n    ];', start);
  if (start < 0 || end < 0) throw new Error('PACKS array not found');
  const block = html.slice(start, end);
  return Array.from(new Set(
    [...block.matchAll(/\bcode\s*:\s*'([a-z0-9]+)'/gi)].map(match => match[1].toLowerCase())
      .concat(['pa', 'pb', 'pc'])
  )).sort();
}

async function fetchShard(code) {
  const url = BASE + '/' + encodeURIComponent(code) + '/' + encodeURIComponent(code) + '.gameplay.min.json';
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + code);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Unexpected JSON shape for ' + code);
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

function auditCard(card, parsers) {
  const results = [];
  const id = String(card.id || '');
  const common = { set: String(card.set_code || id.split('-')[0] || ''), id, name: String(card.name || '') };

  if (card.ability && card.ability.exists) {
    const text = String(card.ability.effect || '').trim();
    if (text && !parsers.ability(text)) results.push(Object.assign({}, common, { kind: 'ability', text }));
  }

  for (const attack of Object.values(card.attacks || {})) {
    if (!attack || !attack.name) continue;
    const text = String(attack.effect || '').trim();
    const damage = String(attack.damage === undefined ? '' : attack.damage);
    const parsed = parsers.attack(text);
    if ((text && !parsed) || (!/^\d+$/.test(damage) && !parsed)) {
      results.push(Object.assign({}, common, {
        kind: 'attack', attack: String(attack.name),
        text: text || ('damage=' + damage)
      }));
    }
  }
  return results;
}

async function main() {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const parsers = loadParsers(html);
  const codes = getSetCodes(html);
  const report = { source: BASE, generatedAt: new Date().toISOString(), sets: [], candidates: [] };

  for (let offset = 0; offset < codes.length; offset += CONCURRENCY) {
    const batch = codes.slice(offset, offset + CONCURRENCY);
    const results = await Promise.all(batch.map(async code => {
      try {
        const cards = await fetchShard(code);
        return { code, cardCount: cards.length, candidates: cards.flatMap(card => auditCard(card, parsers)) };
      } catch (error) {
        return { code, error: String(error), cardCount: 0, candidates: [] };
      }
    }));
    for (const result of results) {
      report.sets.push({ code: result.code, cardCount: result.cardCount, error: result.error || null });
      report.candidates.push.apply(report.candidates, result.candidates);
      console.log(result.code + ': ' + result.cardCount + ' cards, ' + result.candidates.length +
        ' parser candidates' + (result.error ? ' (' + result.error + ')' : ''));
    }
  }

  const failedSets = report.sets.filter(set => set.error);
  const attackCount = report.candidates.filter(candidate => candidate.kind === 'attack').length;
  const abilityCount = report.candidates.filter(candidate => candidate.kind === 'ability').length;
  const uniqueCards = new Set(report.candidates.map(candidate => candidate.id));
  console.log('\nAudit summary');
  console.log('Sets: ' + (report.sets.length - failedSets.length) + '/' + report.sets.length + ' loaded');
  console.log('Cards: ' + report.sets.reduce((sum, set) => sum + set.cardCount, 0));
  console.log('Unparsed attack-effect candidates: ' + attackCount);
  console.log('Unparsed Ability candidates: ' + abilityCount);
  console.log('Unique candidate card IDs: ' + uniqueCards.size);
  console.log('Note: candidates require card-specific implementation checks before being classified as unsupported.');

  const jsonArg = process.argv.indexOf('--json');
  if (jsonArg >= 0 && process.argv[jsonArg + 1]) {
    const outputPath = path.resolve(process.cwd(), process.argv[jsonArg + 1]);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
    console.log('Full candidate report written to ' + outputPath);
  } else if (process.argv.includes('--all')) {
    for (const candidate of report.candidates) console.log(JSON.stringify(candidate));
  }

  if (failedSets.length) process.exitCode = 2;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
