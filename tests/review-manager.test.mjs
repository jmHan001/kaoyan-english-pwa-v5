import assert from'node:assert/strict';

const store=new Map();
globalThis.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};

const{getState,saveState}=await import('../vocabulary-manager.js');
const{rate}=await import('../review-manager.js');

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
