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
  ky5_state:{records:{recent:{lastSeen:new Date(seenAt).toISOString(),correctStreak:1,drawn:true}},history:{},rounds:{gaokao:1,kaoyan:1}},
  ky5_pool:{date:today,mode:'gaokao',items:['replacement'],completed:[],locked:[],updatedAt:seenAt+500}
}},remote);
assert.deepEqual(conflict.data.ky5_pool.items,['recent'],'a newer replacement pool should recover today recent correct words');
assert.deepEqual(conflict.data.ky5_pool.completed,['recent']);
assert.equal(conflict.data.ky5_state.records.recent.todayDoneDate,today);

const masteredAt=Date.parse('2026-07-20T08:00:00+08:00');
const failedAt=masteredAt+86400000;
const staleMastery={memoryVersion:2,lastSeen:masteredAt,lastPassedAt:masteredAt,drawn:true,recognitionCount:2,recallPassDates:['2026-07-18','2026-07-19'],contextPassDates:['2026-07-20'],stabilityDays:20,difficulty:4,tailStage:true,level:4};
const freshFailure={memoryVersion:2,lastSeen:failedAt,lastFailedAt:failedAt,lastPassedAt:masteredAt-1000,cycleStartedAt:failedAt,drawn:true,recognitionCount:2,recallPassDates:[],contextPassDates:[],needsRelearning:true,errors:1,lapses:1,stabilityDays:2,difficulty:6,tailStage:false,level:1};
const failureWins=mergeSnapshots({version:2,savedAt:failedAt,data:{ky5_state:{records:{fragile:freshFailure},history:{},rounds:{gaokao:1,kaoyan:1}}}},{version:2,savedAt:masteredAt,data:{ky5_state:{records:{fragile:staleMastery},history:{},rounds:{gaokao:1,kaoyan:1}}}});
assert.equal(failureWins.data.ky5_state.records.fragile.needsRelearning,true,'newer failure must survive cross-device merge');
assert.deepEqual(failureWins.data.ky5_state.records.fragile.recallPassDates,[],'stale mastery must not resurrect the current correct cycle');
assert.equal(syncSummary(failureWins).mastered,0);

const recoveryPass={...freshFailure,lastSeen:failedAt+1000,lastPassedAt:failedAt+1000,needsRelearning:false,recognitionCount:3};
const recoveryWins=mergeSnapshots({version:2,savedAt:failedAt+1000,data:{ky5_state:{records:{fragile:recoveryPass},history:{},rounds:{gaokao:1,kaoyan:1}}}},{version:2,savedAt:masteredAt,data:{ky5_state:{records:{fragile:staleMastery},history:{},rounds:{gaokao:1,kaoyan:1}}}});
assert.deepEqual(recoveryWins.data.ky5_state.records.fragile.recallPassDates,[],'a recognition after failure must not revive stale recall passes');
assert.equal(syncSummary(recoveryWins).mastered,0);

const settingsWinner=mergeSnapshots({version:2,savedAt:1,data:{ky5_settings:{mode:'gaokao',daily:10,updatedAt:100}}},{version:2,savedAt:2,data:{ky5_settings:{mode:'kaoyan',daily:30,updatedAt:200}}});
assert.equal(settingsWinner.data.ky5_settings.daily,30,'the latest settings edit should win across devices');

const favoriteWinner=mergeSnapshots({version:2,savedAt:1,data:{ky5_state:{records:{focus:{drawn:true,favorite:false,updatedAt:100}},history:{},rounds:{gaokao:1,kaoyan:1}}}},{version:2,savedAt:2,data:{ky5_state:{records:{focus:{drawn:true,favorite:true,updatedAt:200}},history:{},rounds:{gaokao:1,kaoyan:1}}}});
assert.equal(favoriteWinner.data.ky5_state.records.focus.favorite,true,'the latest favorite edit should win across devices');

const acquisitionMerge=mergeSnapshots({version:2,savedAt:2,data:{
  ky5_state:{records:{fresh:{memoryVersion:3,drawn:true,lastSeen:200,todayExposedDate:today,todayRecalledDate:today,exposureDates:[today],acquisitionSuccessCount:1}},history:{},rounds:{gaokao:1,kaoyan:1}},
  ky5_pool:{date:today,mode:'gaokao',items:['fresh'],completed:['fresh'],locked:[],manual:[],updatedAt:2}
}},{version:2,savedAt:1,data:{
  ky5_state:{records:{fresh:{memoryVersion:3,drawn:true,lastSeen:100,exposureDates:['2026-07-23'],acquisitionMisses:1}},history:{},rounds:{gaokao:1,kaoyan:1}},
  ky5_pool:{date:today,mode:'gaokao',items:['fresh','focus'],completed:[],locked:[],manual:['focus'],updatedAt:1}
}});
assert.equal(acquisitionMerge.data.ky5_state.records.fresh.todayRecalledDate,today,'same-day recall evidence must survive sync');
assert.deepEqual(acquisitionMerge.data.ky5_state.records.fresh.exposureDates.sort(),['2026-07-23',today].sort());
assert.equal(acquisitionMerge.data.ky5_pool.manual.includes('focus'),true,'manual daily-pool additions must survive sync');
assert.equal(acquisitionMerge.data.ky5_pool.items.includes('focus'),true);

console.log('cloud-sync tests passed');
