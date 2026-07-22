import assert from'node:assert/strict';
import{todayQuizCandidates}from'../quiz-scope.js';

const today='2026-07-22';
const pool={items:['today-a','today-b','not-studied','slain'],completed:['today-a']};
const records={
  'today-b':{todayDoneDate:today},
  'not-studied':{drawn:true},
  slain:{todayDoneDate:today,slain:true},
  'old-wrong':{errors:8,todayDoneDate:'2026-07-21'},
  'due-word':{due:1,todayDoneDate:'2026-07-20'}
};

assert.deepEqual(todayQuizCandidates(pool,records,today),['today-a','today-b']);
assert.equal(todayQuizCandidates(pool,records,today).includes('old-wrong'),false,'historical wrong words must stay out of today quiz');
assert.equal(todayQuizCandidates(pool,records,today).includes('due-word'),false,'due review words must stay out of today quiz');

console.log('quiz-scope tests passed');
