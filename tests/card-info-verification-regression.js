// Run from repository root: node tests/card-info-verification-regression.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('function applySupplementalCardData(');
const end = html.indexOf('// Supplemental card data:', start);
assert.ok(start >= 0 && end > start, 'the source merge helper must exist');
const hasJapaneseText = value => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ''));
const apply = new Function('hasJapaneseText', html.slice(start,end)+'; return applySupplementalCardData;')(hasJapaneseText);
function makeCard(){ return {id:'test',category:'Catalog',type:'Colorless',name:'テスト',collectionOnly:true}; }
const druddigonA1a = makeCard();
apply(druddigonA1a,{
  name:'Druddigon',category:'Pokemon',type:'Dragon',stage:'Basic',evolvesFrom:'',hp:100,
  weakness:'None',retreat:2,attacks:[{name:'Dragon Claw',damage:90,damageLabel:'90',cost:['Fire','Water','Colorless'],text:'',genericEffect:null,unsupportedEffect:false}],
  ability:{name:'Rough Skin',text:"If this Pokémon is in the Active Spot and is damaged by an attack from your opponent's Pokémon, do 20 damage to the Attacking Pokémon."},
  text:'',ex:false,points:1
},{nameJa:'クリムガン',hp:100,typeJa:'竜',stageJa:'たね',retreatCost:2,abilities:[{name:'さめはだ',effect:'このポケモンが、バトル場で相手のポケモンからワザのダメージを受けたとき、ワザを使ったポケモンに20ダメージ。'}],attacks:[{name:'ドラゴンクロー',damage:'90',effect:''}]},[
  {name:'Dragon Claw',damage:90,damageLabel:'90',cost:['Fire','Water','Colorless'],text:'',genericEffect:null,unsupportedEffect:false}
],{name:'Rough Skin',text:"If this Pokémon is in the Active Spot and is damaged by an attack from your opponent's Pokémon."},'');
assert.equal(druddigonA1a.dataVerified,true);
assert.equal(druddigonA1a.hp,100);
assert.equal(druddigonA1a.attacks[0].jpName,'ドラゴンクロー');
assert.equal(druddigonA1a.ability.jpName,'さめはだ');
assert.equal(druddigonA1a.retreat,2);

const druddigonB1 = makeCard();
apply(druddigonB1,{
  name:'Druddigon',category:'Pokemon',type:'Dragon',stage:'Basic',evolvesFrom:'',hp:110,
  weakness:'None',retreat:2,attacks:[{name:'Giga Claw',damage:120,damageLabel:'120',cost:['Fire','Water','Colorless','Colorless'],text:'Flip 2 coins. If both of them are tails, this attack does nothing.',genericEffect:null,unsupportedEffect:true}],
  ability:null,text:'',ex:false,points:1
},{nameJa:'クリムガン',hp:110,typeJa:'竜',stageJa:'たね',retreatCost:2,abilities:[],attacks:[{name:'ギガクロー',damage:'120',effect:'コインを2回投げ、すべてウラなら、このワザは失敗。'}]},[
  {name:'Giga Claw',damage:120,damageLabel:'120',cost:['Fire','Water','Colorless','Colorless'],text:'Flip 2 coins. If both of them are tails, this attack does nothing.',genericEffect:null,unsupportedEffect:true}
],null,'');
assert.equal(druddigonB1.dataVerified,true);
assert.equal(druddigonB1.hp,110);
assert.equal(druddigonB1.attacks[0].jpName,'ギガクロー');
assert.equal(druddigonB1.attacks[0].jpText,'コインを2回投げ、すべてウラなら、このワザは失敗。');
assert.equal(druddigonB1.ability,null);

const druddigonB2b = makeCard();
apply(druddigonB2b,{
  name:'Druddigon',category:'Pokemon',type:'Dragon',stage:'Basic',evolvesFrom:'',hp:100,
  weakness:'None',retreat:2,attacks:[{name:'Clutch',damage:40,damageLabel:'40',cost:['Colorless','Colorless'],text:"During your opponent's next turn, the Defending Pokémon can't retreat.",genericEffect:{defendingCannotRetreatNextTurn:true},unsupportedEffect:false}],
  ability:null,text:'',ex:false,points:1
},{nameJa:'クリムガン',hp:100,typeJa:'ドラゴン',stageJa:'たね',retreatCost:2,abilities:[],attacks:[{name:'わしづかみ',damage:'40',effect:'次の相手の番、このワザを受けたポケモンはにげるができない。'}]},[
  {name:'Clutch',damage:40,damageLabel:'40',cost:['Colorless','Colorless'],text:"During your opponent's next turn, the Defending Pokémon can't retreat.",genericEffect:{defendingCannotRetreatNextTurn:true},unsupportedEffect:false}
],null,'');
assert.equal(druddigonB2b.dataVerified,true);
assert.equal(druddigonB2b.hp,100);
assert.equal(druddigonB2b.attacks[0].jpName,'わしづかみ');
assert.equal(druddigonB2b.attacks[0].jpText,'次の相手の番、このワザを受けたポケモンはにげるができない。');

const darkraiEx=makeCard();
apply(darkraiEx,{
  name:'Darkrai ex',category:'Pokemon',type:'Darkness',stage:'Basic',evolvesFrom:'',hp:140,
  weakness:'Grass',retreat:2,attacks:[{name:'Dark Prism',damage:80,damageLabel:'80',cost:['Darkness','Darkness','Colorless'],text:'',genericEffect:null,unsupportedEffect:false}],
  ability:{name:'Nightmare Aura',text:"Whenever you attach a [D] Energy from your Energy Zone to this Pokémon, do 20 damage to your opponent's Active Pokémon."},
  text:'',ex:true,points:2
},{nameJa:'ダークライex',hp:140,typeJa:'悪',stageJa:'たね',retreatCost:2,abilities:[{name:'ナイトメアオーラ',effect:'自分のエネルギーゾーンからこのポケモンに悪エネルギーをつけるたび、相手のバトルポケモンに20ダメージ。'}],attacks:[{name:'ダークプリズム',damage:'80',effect:''}]},[
  {name:'Dark Prism',damage:80,damageLabel:'80',cost:['Darkness','Darkness','Colorless'],text:'',genericEffect:null,unsupportedEffect:false}
],{name:'Nightmare Aura',text:"Whenever you attach a [D] Energy from your Energy Zone to this Pokémon, do 20 damage to your opponent's Active Pokémon."},'');
assert.equal(darkraiEx.dataVerified,true);
assert.equal(darkraiEx.hp,140);
assert.equal(darkraiEx.isEx,true);
assert.equal(darkraiEx.ability.jpName,'ナイトメアオーラ');

const mismatch=makeCard();
apply(mismatch,{name:'Test',category:'Pokemon',type:'Dragon',stage:'Basic',hp:100,weakness:'None',retreat:2,attacks:[{name:'A',damage:60,damageLabel:'60',cost:[],text:''}],ability:null,text:'',ex:false,points:1},{nameJa:'テスト',hp:110,typeJa:'竜',stageJa:'たね',retreatCost:2,abilities:[],attacks:[{name:'A',damage:'60',effect:''}]},[{name:'A',damage:60,damageLabel:'60',cost:[],text:''}],null,'');
assert.equal(mismatch.dataVerified,false,'conflicting printed HP must stay unverified');
assert.ok(mismatch.dataVerificationIssues.includes('HP'));

assert.match(html,/ui\.openCardModal=function\(card/);
assert.match(html,/CARD_DATA_SUPPLEMENT\.loadSet\(code,false\)/);
assert.match(html,/ui\.closeCardModal=function\(\)\{cardDetailLoadRequest\+\+;/);
assert.match(html,/カードの基本情報・ワザ・特性を参照データと収録番号単位で照合済み/);
assert.match(html,/対戦シミュレーターの効果処理が未対応/);
console.log('All card-information verification regression checks passed.');
