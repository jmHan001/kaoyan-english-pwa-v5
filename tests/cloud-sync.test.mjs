import assert from'node:assert/strict';

const store=new Map();
globalThis.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};

const{mergeSnapshots,syncSummary}=await import('../cloud-sync.js');
const{localDateKey}=await import('../date-utils.js');
const today=localDateKey();
const local={version:1,savedAt:2,data:{
  ky5_settings:{mode:'gaokao',daily:30},
  ky5_state:{records:{learned:{todayDoneDate:today,lastSeen:2,drawn:true}},history:{},rounds:{gaokao:1,kaoyan:1}},
  ky5_pool:{date:today,mode:'gaokao',items:['replacement'],completed:[],locked:[],updatedAt:2}
}};
const remote={version:1,savedAt:1,data:{
  ky5_state:{records:{},history:{},rounds:{gaokao:1,kaoyan:1}},
  ky5_pool:{date:today,mode:'gaokao',items:['replacement'],completed:[],locked:[],updatedAt:1}
}};
const merged=mergeSnapshots(local,remote);
assert.equal(merged.data.ky5_pool.items.includes('learned'),true,'sync should restore today completed words to the pool');
assert.equal(merged.data.ky5_pool.completed.includes('learned'),true,'sync should preserve today completion');
assert.equal(syncSummary(merged).poolDone,1);

const seenAt=Date.now()-1000;
const conflict=mergeSnapshots({version:1,savedAt:4,data:{
  ky5_settings:{mode:'gaokao',daily:1},
  ky5_state:{records:{recent:{lastSeen:seenAt,correctStreak:1,drawn:true}},history:{},rounds:{gaokao:1,kaoyan:1}},
  ky5_pool:{date:today,mode:'gaokao',items:['replacement'],completed:[],locked:[],updatedAt:seenAt+500}
}},remote);
assert.deepEqual(conflict.data.ky5_pool.items,['recent'],'a newer replacement pool should recover today recent correct words');
assert.deepEqual(conflict.data.ky5_pool.completed,['recent']);
assert.equal(conflict.data.ky5_state.records.recent.todayDoneDate,today);

console.log('cloud-sync tests passed');
