import assert from'node:assert/strict';
import{upgradeMemoryRecord,memoryStage,memoryLabel,questionTypeForRecord,recordMemoryAnswer}from'../memory-engine.js';

const day1=Date.parse('2026-07-20T08:00:00+08:00');
assert.equal(memoryStage({drawn:true}),'new','being drawn into a pool is not evidence of recognition');
let record=upgradeMemoryRecord({drawn:true,correctStreak:3,tailStage:true,level:4,lastSeen:day1-86400000});
assert.equal(memoryStage(record),'recognition','legacy 3-in-a-row data must wait for active recall verification');
assert.match(memoryLabel(record),/待主动验证/);
assert.equal(questionTypeForRecord(record),'recall','legacy choice-only mastery must be verified without options');

record=recordMemoryAnswer(record,{correct:true,kind:'recognition',at:day1,date:'2026-07-20'});
assert.equal(memoryStage(record),'recognition');
assert.equal(record.due,day1+86400000);

record=recordMemoryAnswer(record,{correct:true,kind:'recall',at:day1+86400000,date:'2026-07-21'});
assert.equal(memoryStage(record),'recall');
assert.equal(record.recallPassDates.length,1);
assert.equal(questionTypeForRecord(record),'recall');

record=recordMemoryAnswer(record,{correct:true,kind:'recall',at:day1+4*86400000,date:'2026-07-24'});
assert.equal(memoryStage(record),'context');
assert.equal(questionTypeForRecord(record,{hasContext:true}),'context');

record=recordMemoryAnswer(record,{correct:true,kind:'context',at:day1+11*86400000,date:'2026-07-31'});
assert.equal(memoryStage(record),'mastered');
assert.equal(record.tailStage,true);
assert.ok(record.due>=day1+26*86400000,'mastered interval should extend beyond the fixed 15-day ceiling');

const failed=recordMemoryAnswer(record,{correct:false,kind:'recall',at:day1+12*86400000,date:'2026-08-01'});
assert.equal(memoryStage(failed),'relearning');
assert.equal(failed.correctStreak,0);
assert.equal(failed.recallPassDates.length,0);
assert.ok(failed.recallHistoryDates.length>=2,'historical successful recalls should be preserved');
assert.equal(failed.due,day1+12*86400000+10*60000);

console.log('memory-engine tests passed');
