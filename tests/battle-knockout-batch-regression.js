// Regression checks for batched knockouts, simultaneous points, and promotion order.
'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');

function method(name, signature){
  const start=html.indexOf(signature||('\n      '+name+'('));
  assert.ok(start>=0,'missing method: '+name);
  const end=html.indexOf('\n      },',start);
  assert.ok(end>start,'could not find method end: '+name);
  return html.slice(start,end+8);
}

const cardMap={
  attacker:{name:'Attacker',type:'Fire',pointValue:1},
  reactor:{name:'Reactive Pokémon',type:'Water',pointValue:1,ability:{genericEffect:{counterDamageOnKnockout:30}}},
  defender:{name:'Defender',type:'Grass',pointValue:1},
  playerBackup:{name:'Player Backup',type:'Fire',pointValue:1},
  cpuBackup:{name:'CPU Backup',type:'Water',pointValue:1}
};
const batch=new Function('CARD_MAP','getCardDisplayName',
  'return ({'+method('resolveKnockoutBatch','\n      resolveKnockoutBatch({attackingSide=null')+'}).resolveKnockoutBatch;'
)(cardMap,card=>card?.name||'Pokémon');
const promote=new Function('CARD_MAP','getCardDisplayName',
  'return ({'+method('promote','\n      promote(side, bi) {')+'}).promote;'
)(cardMap,card=>card?.name||'Pokémon');
const checkKO=new Function('CARD_MAP','getCardDisplayName',
  'return ({'+method('checkKO','\n      checkKO(defSide, z, i, isBench = false) {')+'}).checkKO;'
)(cardMap,card=>card?.name||'Pokémon');

function inst(cardId,hp=100){return {cardId,hp,maxHp:100,under:[],energies:[]};}
function context(pActive,pBench,oActive,oBench){
  return {
    over:false,turn:4,mode:'cpu',isOnlineP2P:false,
    resolvingAttackSide:null,resolvingKnockoutBatch:true,
    pendingSelfKO:false,pendingPromotionNext:null,pendingCpuPromotionAfterPlayer:false,
    promotionModalOpen:false,actionLocked:false,pendingRemotePassTurn:false,
    p:{active:pActive,bench:pBench,discard:[],points:0,name:'Player'},
    o:{active:oActive,bench:oBench,discard:[],points:0,name:'CPU'},
    log(){},render(){this.renderCount=(this.renderCount||0)+1;},
    showDmg(){},openPromotionSelector(){this.promotionOpened=true;},
    endMatch(winner,reason){this.over=true;this.winner=winner;this.reason=reason;},
    startTurn(side){this.startedSide=side;},
    syncToPeer(){this.synced=true;}
  };
}

// A KO-triggered counter must hit the original attacker, not a newly promoted Pokémon.
// Both Active Pokémon are removed together and both players receive their point.
let attacker=inst('attacker',20);
let reactor=inst('reactor',0);
let ctx=context(attacker,[inst('playerBackup')],reactor,[inst('cpuBackup')]);
batch.call(ctx,{attackingSide:'player',attackingInst:attacker,defendingInst:reactor,afterAttack:true});
assert.equal(attacker.hp,-10,'counterDamageOnKnockout must damage the original attacker');
assert.equal(ctx.p.active,null,'the counter should KO the original player Active');
assert.equal(ctx.o.active.cardId,'cpuBackup','the CPU should promote when its side is next');
assert.equal(ctx.p.points,1,'the defender KO awards its point');
assert.equal(ctx.o.points,1,'the reactive counter KO awards its point');
assert.ok(ctx.p.discard.includes('attacker'));
assert.ok(ctx.o.discard.includes('reactor'));
assert.deepEqual(ctx.o.lastKOByOpponentAttack,{turn:4,types:['Water']},
  'attack KO type must remain available to next-turn attack conditions');
assert.equal(ctx.pendingSelfKO,true);
assert.equal(ctx.promotionOpened,true);

// When the next side is the human player, the CPU promotion waits until after
// the player makes their mandatory Active choice.
attacker=inst('attacker',20);
reactor=inst('reactor',0);
ctx=context(inst('reactor',0),[inst('playerBackup')],attacker,[inst('cpuBackup')]);
batch.call(ctx,{attackingSide:'opp',attackingInst:attacker,defendingInst:ctx.p.active,afterAttack:true});
assert.equal(ctx.pendingCpuPromotionAfterPlayer,true);
assert.equal(ctx.o.active,null,'the CPU must not promote before the next player chooses');
assert.equal(ctx.pendingPromotionNext.side,'player');
promote.call(ctx,'player',0);
assert.equal(ctx.p.active.cardId,'playerBackup');
assert.equal(ctx.o.active.cardId,'cpuBackup','CPU promotes after the human choice');
assert.equal(ctx.pendingCpuPromotionAfterPlayer,false);

// Pokémon Checkup also resolves both boards before checking either player's win condition.
ctx=context(inst('defender',0),[inst('playerBackup')],inst('attacker',0),[inst('cpuBackup')]);
batch.call(ctx,{nextSide:'player',afterCheckup:true});
assert.equal(ctx.pendingCpuPromotionAfterPlayer,true,'next player promotes first after Checkup');
assert.equal(ctx.o.active,null);
assert.equal(ctx.pendingPromotionNext.side,'player');

// Simultaneous third points with both sides still able to promote is a draw.
ctx=context(inst('defender',0),[inst('playerBackup')],inst('attacker',0),[inst('cpuBackup')]);
ctx.p.points=2;
ctx.o.points=2;
batch.call(ctx,{});
assert.equal(ctx.p.points,3);
assert.equal(ctx.o.points,3);
assert.equal(ctx.winner,'draw','both players reaching three points together must draw');

// If both players lose their last Pokémon simultaneously, neither side wins.
ctx=context(inst('defender',0),[],inst('attacker',0),[]);
batch.call(ctx,{});
assert.equal(ctx.winner,'draw','simultaneous field elimination must draw');

// The side that leaves the opponent with no Pokémon wins when only one side
// is eliminated and neither side has already reached three points.
ctx=context(inst('defender',0),[],inst('attacker',100),[]);
batch.call(ctx,{});
assert.equal(ctx.winner,'opp','the player with no Pokémon in play loses');

// Existing checkKO callers must not remove or score a Pokémon while the batch is open.
ctx=context(inst('defender',0),[],inst('attacker',100),[]);
assert.equal(checkKO.call(ctx,'player','active',0,false),true);
assert.equal(ctx.p.active.cardId,'defender');
assert.equal(ctx.p.discard.length,0);
assert.equal(ctx.o.points,0);

console.log('All simultaneous knockout and promotion regression checks passed.');
