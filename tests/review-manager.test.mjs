import assert from'node:assert/strict';

const store=new Map();
globalThis.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};

const{getState,saveState}=await import('../vocabulary-manager.js');
const{rate,dueWords,wrongWords,slayWord,restoreSlainWord}=await import('../review-manager.js');

{
  const state=getState();
  state.records.abandon={word:'abandon',level:4,correctStreak:3,tailStage:true,errors:0,drawn:true};
  saveState(state);
  const record=rate('abandon',1,'kaoyan');
  assert.equal(record.correctStreak,0);
  assert.equal(record.tailStage,false);
  assert.equal(record.level,1);
  assert.equal(record.errors,1);
}

{
  const state=getState();
  state.records.difficult={level:1,correctStreak:0,tailStage:false,errors:4,step:2,due:Date.now()-1000,drawn:true,todayDoneDate:'2026-07-17'};
  saveState(state);
  const slain=slayWord('difficult','kaoyan');
  assert.equal(slain.slain,true);
  assert.equal(slain.level,4);
  assert.equal(slain.errors,0);
  assert.equal(wrongWords().includes('difficult'),false);
  assert.equal(dueWords().includes('difficult'),false);
  const restored=restoreSlainWord('difficult');
  assert.equal(restored.slain,false);
  assert.equal(restored.level,1);
  assert.equal(restored.errors,4);
  assert.equal(restored.step,2);
  assert.equal(restored.todayDoneDate,'2026-07-17');
  assert.equal(wrongWords().includes('difficult'),true);
  assert.equal(dueWords().includes('difficult'),true);
}

{
  const first=rate('abandon',3,'kaoyan');
  assert.equal(first.correctStreak,1);
  assert.equal(first.tailStage,false);
  const second=rate('abandon',3,'kaoyan');
  const third=rate('abandon',3,'kaoyan');
  assert.equal(second.correctStreak,2);
  assert.equal(third.correctStreak,3);
  assert.equal(third.tailStage,true);
  assert.equal(third.level,4);
}

console.log('review-manager tests passed');
