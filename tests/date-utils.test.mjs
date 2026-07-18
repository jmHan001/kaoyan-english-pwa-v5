import assert from'node:assert/strict';
import{localDateKey,localDayStart}from'../date-utils.js';

const earlyMorning=new Date(2026,6,18,7,15,0);
assert.equal(localDateKey(earlyMorning),'2026-07-18','local date must not roll over at 08:00 in China');
assert.equal(new Date(localDayStart(earlyMorning)).getHours(),0);
assert.equal(new Date(localDayStart(earlyMorning)).getDate(),18);

console.log('date-utils tests passed');
