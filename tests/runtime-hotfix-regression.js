// Run from repository root: node tests/runtime-hotfix-regression.js
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync('runtime-fixes.js', 'utf8');
const setup = [
  "const ENERGY_TYPES=['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Colorless','Dragon'];",
  "const dratini={id:'dratini',name:'ミニリュウ',sourceNameEN:'Dratini',category:'Pokemon',stage:'Basic'};",
  "const dragonair={id:'dragonair-supplement',name:'ハクリュー',sourceNameEN:'Dragonair',evolvesFrom:'Dratini',category:'Pokemon',stage:'Stage1'};",
  "const dragonite={id:'dragonite',name:'カイリュー',sourceNameEN:'Dragonite',evolvesFrom:'Dragonair',category:'Pokemon',stage:'Stage2'};",
  "const CARDS=[dratini,dragonite], CARD_MAP={dratini,dragonair,dragonite};",
  "function normalizeEnergyTypes(v){const a=[...new Set((Array.isArray(v)?v:[]).filter(x=>ENERGY_TYPES.includes(x)))].slice(0,3);return a.length?a:['Fire'];}",
  "function isEvolutionFrom(e,p){const names=[e?.evolvesFrom].map(x=>String(x||'').toLowerCase());return names.includes(String(p?.sourceNameEN||p?.name||'').toLowerCase());}",
  "function escapeHtml(v){return String(v); } function renderTypeBadgeSvg(v){return '<b>'+v+'</b>';}",
  "const els=new Map(); for(const id of ['home-deck-selector','lobby-deck-selector','home-deck-energies','lobby-active-deck-name','lobby-active-deck-energies','battle-energy-type-pool']) els.set(id,{innerHTML:'',textContent:'',title:'',value:'',options:[],setAttribute(){}});",
  "const document={readyState:'complete',getElementById:id=>els.get(id)||null,addEventListener(){}}; const ui={toast(){}};",
  "const accountMgr={data:{activeDeckSlot:0,decks:[{name:'ドラゴン',cards:['dratini'],energies:['Water','Lightning']}]},getActiveDeck(){return this.data.decks[this.data.activeDeckSlot];},refreshUI(){},saveCurrent(){this.refreshUI();},selectActiveDeck(i){i=Number(i);if(!this.data.decks[i])return false;this.data.activeDeckSlot=i;this.saveCurrent();return true;}};",
  "const deckBuilder={currentSlot:0,tempEnergies:['Water'],loadSlot(){},saveDeck(){},render(){},toggleEnergyType(t){if(!this.tempEnergies.includes(t))this.tempEnergies.push(t);this.render();}};",
  "const battle={turn:3,p:{hand:['dragonite'],active:null,bench:[{cardId:'dratini',turnPlayed:1}],energyTypes:['Water','Lightning']},o:{hand:[],active:null,bench:[]},canEvolveNow(){return true;},getRareCandyOptions(){return CARDS.some(c=>c.stage==='Stage1')?['old']:[];},evolveCard(side,idx,z,i,candy){const evo=CARD_MAP[this.p.hand[idx]],base=CARD_MAP[this.p.bench[i].cardId];const ok=candy&&base.stage==='Basic'&&evo.stage==='Stage2'&&CARDS.some(c=>c.stage==='Stage1'&&isEvolutionFrom(c,base)&&isEvolutionFrom(evo,c));if(ok){this.p.hand.splice(idx,1);this.p.bench[i].cardId=evo.id;}return ok;},initSide(cards,energies){return {energyTypes:energies};},render(){}};"
].join('\\n');
const context = vm.createContext({ console, Map, Set, Object, Array, Number, String, JSON });
vm.runInContext(setup, context);
vm.runInContext(code, context);
assert.equal(vm.runInContext('battle.getRareCandyOptions("player").length', context), 1);
assert.equal(vm.runInContext('battle.evolveCard("player",0,"bench",0,true)', context), true);
assert.equal(vm.runInContext('battle.p.bench[0].cardId', context), 'dragonite');
assert.equal(vm.runInContext('CARDS.length', context), 2);
vm.runInContext('deckBuilder.toggleEnergyType("Lightning")', context);
assert.deepEqual(Array.from(vm.runInContext('accountMgr.data.decks[0].energies', context)), ['Water','Lightning']);
vm.runInContext('battle.render()', context);
assert.match(vm.runInContext('els.get("battle-energy-type-pool").innerHTML', context), /Water.*Lightning/);
console.log('All runtime hotfix regression checks passed.');