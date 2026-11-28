// Regression coverage for Pokémon TCG Pocket pack probabilities and point costs.
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');

function method(name,signature){
  const start=html.indexOf(signature||('\n      '+name+'('));
  assert.ok(start>=0,'missing method: '+name);
  const end=html.indexOf('\n      },',start);
  assert.ok(end>start,'could not find method end: '+name);
  return html.slice(start,end+8);
}

const rateStart=html.indexOf('const PACK_SLOT_RATES = {');
const helperEnd=html.indexOf('const packSystem = {',rateStart);
assert.ok(rateStart>=0&&helperEnd>rateStart,'pack probability helpers should exist');
const helperSource=html.slice(rateStart,helperEnd);
const helpers=new Function(helperSource+';return {PACK_SLOT_RATES,pickWeightedPackCard};')();
const {PACK_SLOT_RATES,pickWeightedPackCard}=helpers;

const cards=[
  {id:'common',catalogRarity:'C'},
  {id:'uncommon',catalogRarity:'U'},
  {id:'rare',catalogRarity:'R'},
  {id:'doubleRare',catalogRarity:'RR'},
  {id:'artRare',catalogRarity:'AR'},
  {id:'superRare',catalogRarity:'SR'},
  {id:'immersive',catalogRarity:'IM'},
  {id:'crown',catalogRarity:'UR'},
  {id:'shiny',catalogRarity:'S'},
  {id:'shinyTwo',catalogRarity:'SSR'}
];
const rarityOf=card=>card.catalogRarity;
let sequence=[0.99,0];
const random=()=>sequence.shift()??0;
assert.equal(pickWeightedPackCard(cards,[{rarities:['U'],weight:90},{rarities:['R'],weight:10}],rarityOf,random).id,'rare',
  'weighted card choice should select the selected rarity tier');
assert.equal(PACK_SLOT_RATES.standard4.reduce((sum,x)=>sum+x.weight,0),100,
  'standard fourth-slot weights should sum to 100');
assert.ok(Math.abs(PACK_SLOT_RATES.standard5.reduce((sum,x)=>sum+x.weight,0)-100)<0.001,
  'standard fifth-slot weights should sum to 100');
assert.equal(PACK_SLOT_RATES.shiny4.find(x=>x.rarities.includes('S')).weight,0.714);
assert.equal(PACK_SLOT_RATES.shiny5.find(x=>x.rarities.includes('SSR')).weight,1.333);
assert.deepEqual(PACK_SLOT_RATES.bonus.map(x=>x.weight),[68.2,31.8],
  'bonus card rarity mix should preserve the documented shiny ratio');

const open=method('executeOpen','\n      executeOpen(packId, count) {');
assert.match(open,/Math\.random\(\)<0\.0005/,'rare-pack replacement should be sampled at 0.05%');
assert.match(open,/for\(let i=0;i<3;i\+\+\)/,'the first three cards should be drawn separately');
assert.match(open,/hasShinyInMainSlots\?PACK_SLOT_RATES\.shiny4:PACK_SLOT_RATES\.standard4/);
assert.match(open,/hasShinyInMainSlots\?PACK_SLOT_RATES\.shiny5:PACK_SLOT_RATES\.standard5/);
assert.match(open,/pointsEarned=count\*5/,'every opened booster should award five points');
assert.doesNotMatch(open,/forceSr|featuredCard|roll < 0\.35/,
  'there must be no 10-pack guaranteed SR or featured-card shortcut');
assert.match(open,/sourceSet==='a4b'\|\|sourceSet==='b4b'/,
  'Deluxe Pack families should use their four-card rules');
assert.match(open,/['"]RR['"],weight:100/,
  'Deluxe fourth slot should be four-diamond rarity');

const createDefault=method('createDefault');
assert.match(createDefault,/packPointsByExpansion:\s*\{\}/,
  'new accounts need independent expansion balances');
assert.match(html,/loaded\.packPointsByExpansion\s*=\s*loaded\.packPointsByExpansion/,
  'saved expansion balances should be sanitized');
assert.match(html,/ui-points'\)\.textContent = \(this\.data\.packPoints \|\| 0\) \+ Object\.values/,
  'the header should show all legacy and expansion points');

const craft=method('craftCard');
const CARD_MAP={
  cardA1:{id:'cardA1',setCode:'A1',catalogRarity:'SR',rarity:'SR',rarityEstimated:false,name:'A1 card'},
  cardA2:{id:'cardA2',setCode:'A2',catalogRarity:'RR',rarity:'RR',rarityEstimated:false,name:'A2 card'}
};
const accountMgr={
  data:{packPoints:0,packPointsByExpansion:{a1:1250,a2:499},collection:{cardA1:0,cardA2:0}},
  saveCurrent(){this.saved=true;}
};
const craftCard=new Function('CARD_MAP','accountMgr','ui','sound','getCardDisplayName',
  'return ({'+craft+'}).craftCard;')(
    CARD_MAP,accountMgr,{toast(message){this.message=message;}},{energy(){}},card=>card.name
  );
const deck={render(){this.rendered=true;}};
craftCard.call(deck,'cardA1');
assert.equal(accountMgr.data.packPointsByExpansion.a1,0,'SR should cost 1,250 expansion points');
assert.equal(accountMgr.data.collection.cardA1,1);
assert.equal(accountMgr.data.packPointsByExpansion.a2,499,'another expansion balance must not be spent');
assert.equal(accountMgr.saved,true);
craftCard.call(deck,'cardA2');
assert.equal(accountMgr.data.collection.cardA2,0,'a card cannot be crafted using another expansion\'s points');
assert.match(ui.message,/この拡張パックのポイントが足りません/);

console.log('All booster odds and expansion-point regression checks passed.');
