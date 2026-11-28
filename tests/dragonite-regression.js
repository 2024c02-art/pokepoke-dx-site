// Regression checks for Genetic Apex Dragonite.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html','utf8');
assert.match(html,/randomOpponentPokemonDamage:Number\(m\[2\]\),randomOpponentPokemonDamageCount:Number\(m\[1\]\)/);
assert.match(html,/if\(ge\.randomOpponentPokemonDamage>0\)/);
assert.match(html,/target\.inst\.hp>0/);
assert.match(html,/attackDamageWithActiveWeakness\(target\.inst,baseDamage,attC\.type,attC\.isEx,!!ge\.ignoreWeakness\)/);
assert.match(html,/りゅうせいぐん/);
assert.match(html,/function canUnlockSupplementalPokemon/);
assert.ok(html.includes('const playablePokemon=canUnlockSupplementalPokemon('),'supplemental Pokémon should use the safe playability gate');
assert.ok(html.includes('if(ability&&!ability.genericEffect) return false'),'an Ability without a parsed handler must remain collection-only');
console.log('Genetic Apex Dragonite regression checks passed.');
