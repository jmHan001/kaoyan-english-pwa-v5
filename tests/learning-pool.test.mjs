import assert from'node:assert/strict';

const store=new Map();
globalThis.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};
globalThis.fetch=async url=>({
  ok:true,
  json:async()=>String(url).includes('gaokao')
    ?[{word:'alpha',translation:'A'},{word:'beta',translation:'B'},{word:'gamma',translation:'C'}]
    :[{word:'delta',translation:'D'},{word:'epsilon',translation:'E'}]
});

const manager=await import('../vocabulary-manager.js');
await manager.loadVocabulary();
manager.saveSettings({mode:'smart',daily:2});
localStorage.setItem(manager.KEYS.pool,JSON.stringify({date:new Date().toISOString().slice(0,10),mode:'smart',items:[],completed:[],locked:[]}));

const poolManager=await import(`../learning-pool.js?test=${Date.now()}`);
const{localDateKey}=await import('../date-utils.js');
const recovered=poolManager.getPool();
assert.equal(recovered.items.length,2,'an empty synced pool should rebuild automatically');

const today=localDateKey(),state=manager.getState();
state.records.alpha={drawn:true,source:'gaokao',round:1,todayDoneDate:today,correctStreak:1};
state.records.delta={drawn:true,source:'kaoyan',round:1};
manager.saveState(state);
localStorage.setItem(manager.KEYS.pool,JSON.stringify({date:today,mode:'smart',items:['delta','epsilon'],completed:[],locked:[]}));
const restored=poolManager.getPool();
assert.equal(restored.items.includes('alpha'),true,'today completed words should be restored to a replaced pool');
assert.equal(restored.completed.includes('alpha'),true,'restored today words should remain completed');

const before=[...restored.items];
manager.saveSettings({mode:'smart',daily:1});
poolManager.resize(1);
const after=poolManager.getPool();
assert.equal(after.items.length,1);
const removed=before.find(word=>!after.items.includes(word));
assert.equal(manager.getState().records[removed],undefined,'shrinking should release an unstudied generated word');

console.log('learning-pool tests passed');
