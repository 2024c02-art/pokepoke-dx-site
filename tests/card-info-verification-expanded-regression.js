const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('function applySupplementalCardData(');
const end=html.indexOf('// Supplemental card data:',start);
assert.ok(start>=0&&end>start);
const hasJapaneseText=value=>/[\u3040-\u30ff\u3400-\u9fff]/.test(String(value||''));
const applyMethod=new Function('hasJapaneseText',html.slice(start,end)+';return applySupplementalCardData;')(hasJapaneseText);
const parserStart=html.indexOf('\n      parseGenericAbility(');
const parserEnd=html.indexOf('\n      },',parserStart);
assert.ok(parserStart>=0&&parserEnd>parserStart,'generic Ability parser exists');
const parseGenericAbility=new Function('return ({'+html.slice(parserStart,parserEnd+8)+'}).parseGenericAbility;')();
const energyMap={G:'Grass',R:'Fire',W:'Water',L:'Lightning',P:'Psychic',F:'Fighting',D:'Darkness',M:'Metal',C:'Colorless'};
const abilityParserContext={
  energyMap,
  energyEffectType(code){
    const key=String(code||'').trim().toUpperCase();
    return energyMap[key]||({GRASS:'Grass',FIRE:'Fire',WATER:'Water',LIGHTNING:'Lightning',PSYCHIC:'Psychic',FIGHTING:'Fighting',DARKNESS:'Darkness',METAL:'Metal',COLORLESS:'Colorless',DRAGON:'Dragon'})[key]||null;
  }
};
const apply=(...args)=>applyMethod.apply({
  parseGenericAbility(text){return parseGenericAbility.call(abilityParserContext,text);}
},args);
const make=()=>({id:'test',category:'Catalog',type:'Colorless',name:'テスト',collectionOnly:true});
const baseEn={name:'Druddigon',category:'Pokemon',type:'Dragon',stage:'Basic',evolvesFrom:'',hp:100,weakness:'None',retreat:2,ex:false,points:1};
const attack=(name,damage,text='',cost=['Colorless'])=>({name,damage,damageLabel:String(damage),cost,text,genericEffect:null,unsupportedEffect:!!text});
const jp=(overrides={})=>({nameJa:'クリムガン',hp:100,typeJa:'竜',stageJa:'たね',retreatCost:2,cardEffectAvailable:true,abilities:[],attacks:[{name:'ドラゴンクロー',damage:'90',effect:''}],...overrides});
let card=make();
apply(card,{...baseEn,retreat:2},jp({abilities:[{name:'さめはだ',effect:'このポケモンが、バトル場で相手のポケモンからワザのダメージを受けたとき、ワザを使ったポケモンに20ダメージ。'}]}),[attack('Dragon Claw',90)],{name:'Rough Skin',text:"If this Pokémon is in the Active Spot and is damaged by an attack from your opponent's Pokémon, do 20 damage to the Attacking Pokémon."},'');
assert.equal(card.dataVerified,true);
assert.equal(card.japaneseEffectDataVerified,true);
assert.equal(card.attacks[0].jpName,'ドラゴンクロー');

// Druddigon Giga Claw: known Druddigon print data remains verified.
card=make();
apply(card,{...baseEn,hp:110},jp({hp:110,abilities:[],attacks:[{name:'ギガクロー',damage:'120',effect:'コインを2回投げ、すべてウラなら、このワザは失敗。'}]}),[attack('Giga Claw',120,'Flip 2 coins. If both of them are tails, this attack does nothing.',['Fire','Water','Colorless','Colorless'])],null,'');
assert.equal(card.dataVerified,true);
assert.equal(card.japaneseEffectDataVerified,true);

// Druddigon Clutch alternative attack: retreat lock is retained and effect amount is checked.
card=make();
apply(card,baseEn,jp({attacks:[{name:'わしづかみ',damage:'40',effect:'次の相手の番、このワザを受けたポケモンはにげるができない。'}]}),[attack('Clutch',40,"During your opponent's next turn, the Defending Pokémon can't retreat.",['Colorless','Colorless'])],null,'');
assert.equal(card.dataVerified,true);

// Darkrai ex: Nightmare Aura and Dark Prism match the reference record.
card=make();
apply(card,{...baseEn,name:'Darkrai ex',type:'Darkness',hp:140,ex:true,weakness:'Grass',retreat:2}, {nameJa:'ダークライex',hp:140,typeJa:'悪',stageJa:'たね',retreatCost:2,cardEffectAvailable:true,abilities:[{name:'ナイトメアオーラ',effect:'自分のエネルギーゾーンからこのポケモンに悪エネルギーをつけるたび、相手のバトルポケモンに20ダメージ。'}],attacks:[{name:'ダークプリズム',damage:'80',effect:''}]},[attack('Dark Prism',80,'',['Darkness','Darkness','Colorless'])],{name:'Nightmare Aura',text:"Whenever you attach a [D] Energy from your Energy Zone to this Pokémon, do 20 damage to your opponent's Active Pokémon."},'');
assert.equal(card.dataVerified,true);
assert.equal(card.japaneseEffectDataVerified,true);

// Darkrai's non-ex and later reprint versions retain their own distinct official game effects.
card=make();
apply(card,{...baseEn,name:'Darkrai',type:'Darkness',hp:110,weakness:'Grass',retreat:2},{nameJa:'ダークライ',hp:110,typeJa:'悪',stageJa:'たね',retreatCost:2,cardEffectAvailable:true,abilities:[],attacks:[{name:'ダークホール',damage:'60',effect:'相手のバトルポケモンをねむりにする。'}]},[attack('Dark Void',60,"Your opponent's Active Pokémon is now Asleep.",['Darkness','Darkness','Colorless'])],null,'');
assert.equal(card.dataVerified,true);
assert.equal(card.japaneseEffectDataVerified,true);

card=make();
apply(card,{...baseEn,name:'Darkrai',type:'Darkness',hp:100,weakness:'Grass',retreat:2},{nameJa:'ダークライ',hp:100,typeJa:'悪',stageJa:'たね',retreatCost:2,cardEffectAvailable:true,abilities:[{name:'ナイトメア',effect:'おたがいの番の終わりに、相手のバトルポケモンがねむりなら、そのポケモンに20ダメージ。'}],attacks:[{name:'くろいまどろみ',damage:'40',effect:'相手のバトルポケモンをねむりにする。'}]},[attack('Dark Slumber',40,"Your opponent's Active Pokémon is now Asleep.",['Colorless','Colorless','Colorless'])],{name:'Bad Dreams',text:"At the end of each turn, if your opponent's Active Pokémon is Asleep, do 20 damage to that Pokémon."},'');
assert.equal(card.dataVerified,true);
assert.equal(card.japaneseEffectDataVerified,true);

// Japanese cached stats must never override the authoritative gameplay record after a conflict.
card=make();
apply(card,{...baseEn,hp:100,type:'Dragon',stage:'Basic',retreat:2},{nameJa:'クリムガン',hp:120,typeJa:'悪',stageJa:'1進化',retreatCost:3,cardEffectAvailable:true,abilities:[],attacks:[{name:'ドラゴンクロー',damage:'90',effect:''}]},[attack('Dragon Claw',90)],null,'');
assert.equal(card.dataVerified,false);
assert.equal(card.hp,100);
assert.equal(card.type,'Dragon');
assert.equal(card.stage,'Basic');
assert.equal(card.retreat,2);

// Missing Japanese localized effects do not corrupt the complete reference gameplay record.
card=make();
apply(card,baseEn,{nameJa:'クリムガン',hp:100,typeJa:'竜',stageJa:'たね',cardEffectAvailable:false,abilities:[],attacks:[]},[attack('Dragon Claw',90)],null,'');
assert.equal(card.dataVerified,true);
assert.equal(card.dataVerificationCoverage.includes('日本語ワザ詳細は一部未収録'),true);

// Known mismatch in damage, effect amount, ability presence, and attack count is never marked verified.
card=make();
apply(card,baseEn,jp({abilities:[],attacks:[{name:'ドラゴンクロー',damage:'80',effect:'相手に40ダメージ。'}]}),[attack('Dragon Claw',90,'Do 20 damage to your opponent.' )],{name:'Rough Skin',text:'Do 20 damage.'},'');
assert.equal(card.dataVerified,false);
assert.ok(card.dataVerificationIssues.includes('特性数'));
assert.ok(card.dataVerificationIssues.includes('ワザダメージ1'));
assert.ok(card.dataVerificationIssues.includes('ワザ1効果量'));

// Known effect-presence mismatch and attack-count mismatch are also rejected.
card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:''},{name:'かみつく',damage:'20',effect:''}]}),[attack('Dragon Claw',90,'Do 20 damage.')],null,'');
assert.equal(card.dataVerified,false);
assert.ok(card.dataVerificationIssues.includes('ワザ数'));
assert.ok(card.dataVerificationIssues.includes('ワザ効果有無1'));

// Printed attack energy symbols are compared where the Japanese reference includes them.
card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'',cost:{炎:1}}]}),[attack('Dragon Claw',90,'',['Water'])],null,'');
assert.equal(card.dataVerified,false);
assert.ok(card.dataVerificationIssues.includes('ワザ1エネルギー'));

// Meaning-level checks: matching numbers must not hide a Bench-vs-Active mismatch.
card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'相手のベンチポケモンに30ダメージ。'}]}),[attack('Dragon Claw',90,"Do 30 damage to your opponent's Active Pokémon.")],null,'');
assert.equal(card.dataVerified,false,'Bench-vs-Active target mismatch must never be marked verified');
assert.ok(card.dataVerificationIssues.includes('ワザ1対象範囲'),'target-zone mismatch must be reported');

card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'相手のバトルポケモンに30ダメージ。'}]}),[attack('Dragon Claw',90,"Do 30 damage to your opponent's Active Pokémon.")],null,'');
assert.equal(card.dataVerified,true,'equivalent Active target wording should remain verified');

// The target's owner is part of effect meaning, even when the target is Active in both texts.
card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'相手のバトルポケモンに30ダメージ。'}]}),[attack('Dragon Claw',90,'Do 30 damage to your Active Pokémon.')],null,'');
assert.equal(card.dataVerified,false,'opponent-vs-own target mismatch must never be marked verified');
assert.ok(card.dataVerificationIssues.includes('ワザ1対象プレイヤー'),'target-owner mismatch must be reported');


// Effect meaning must be compared, not just numbers and target zones.
card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'相手のバトルポケモンのHPを20回復する。'}]}),
  [attack('Dragon Claw',90,"Do 20 damage to your opponent's Active Pokémon.")],null,'');
assert.equal(card.dataVerified,false,'healing must not be treated as damage');
assert.ok(card.dataVerificationIssues.includes('ワザ1効果種類:回復'));

card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'自分のエネルギーゾーンから水エネルギーを1個、このポケモンにつける。'}]}),
  [attack('Dragon Claw',90,'Discard a Water Energy from this Pokémon.')],null,'');
assert.equal(card.dataVerified,false,'attaching Energy must not be treated as discarding Energy');
assert.ok(card.dataVerificationIssues.includes('ワザ1効果種類:エネルギー付与'));
assert.ok(card.dataVerificationIssues.includes('ワザ1効果種類:エネルギー破棄'));

card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'次の自分の番、このポケモンはにげることができない。'}]}),
  [attack('Dragon Claw',90,"During your opponent's next turn, this Pokémon can't retreat.")],null,'');
assert.equal(card.dataVerified,false,'your next turn and the opponent next turn are different timings');
assert.ok(card.dataVerificationIssues.includes('ワザ1タイミング:次の自分の番'));
assert.ok(card.dataVerificationIssues.includes('ワザ1タイミング:次の相手の番'));

card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'相手のバトルポケモンをねむりにする。'}]}),
  [attack('Dragon Claw',90,"Your opponent's Active Pokémon is now Poisoned.")],null,'');
assert.equal(card.dataVerified,false,'Sleep and Poison are different Special Conditions');
assert.ok(card.dataVerificationIssues.includes('ワザ1効果種類:ねむり'));
assert.ok(card.dataVerificationIssues.includes('ワザ1効果種類:どく'));

card=make();
apply(card,baseEn,jp({attacks:[{name:'ドラゴンクロー',damage:'90',effect:'コインを1回投げ、ウラならこのワザは失敗。'}]}),
  [attack('Dragon Claw',90,'Flip a coin. If heads, this attack does nothing.')],null,'');
assert.equal(card.dataVerified,false,'heads and tails are different coin outcomes');
assert.ok(card.dataVerificationIssues.includes('ワザ1発動条件:ウラ'));
assert.ok(card.dataVerificationIssues.includes('ワザ1発動条件:オモテ'));

console.log('All expanded card-information verification regression checks passed.');
assert.match(html,/カードの基本情報・ワザ・特性を参照データと収録番号単位で照合済み/);
assert.match(html,/日本語効果文は参照データに未登録の項目あり/);
assert.match(html,/対戦シミュレーターの効果処理が未対応/);
