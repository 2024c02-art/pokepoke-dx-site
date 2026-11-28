// Compile the production inline script without executing browser-dependent startup code.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const inline=scripts.filter(([,attributes,body])=>!/\bsrc\s*=/.test(attributes)&&body.trim());
assert.equal(inline.length,1,'the application should expose one inline runtime script');
for(let i=0;i<inline.length;i++){
  const [,attributes,body]=inline[i];
  const type=attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]||'text/javascript';
  assert.match(type,/javascript|ecmascript|module/i,'inline runtime script must be JavaScript');
  new vm.Script(body,{filename:'index.html inline script '+(i+1)});
}
console.log('Application inline script syntax check passed.');
