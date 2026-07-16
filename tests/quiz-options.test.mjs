import assert from'node:assert/strict';
import{buildChoiceOptions}from'../quiz-options.js';

const answer={word:'abandon',translation:'v. 放弃'};
const pool=[
  answer,
  {word:'ability',translation:'n. 能力'},
  {word:'absent',translation:'adj. 缺席的'},
  {word:'absorb',translation:'v. 吸收'},
  {word:'abroad',translation:'adv. 在国外'}
];
const due=[
  {word:'climate',translation:'n. 气候'},
  {word:'injury',translation:'n. 伤害'}
];
const fallback=[
  {word:'culture',translation:'n. 文化'},
  {word:'economy',translation:'n. 经济'}
];

{
  const options=buildChoiceOptions(answer,[pool],fallback,4,()=>0);
  const words=options.map(x=>x.word);
  assert.equal(options.length,4);
  assert(words.includes('abandon'));
  assert.deepEqual(new Set(words).size,4);
  assert(words.filter(word=>pool.some(item=>item.word===word)).length,4);
}

{
  const shortPool=[answer,{word:'ability',translation:'n. 能力'}];
  const options=buildChoiceOptions(answer,[shortPool,due],fallback,4,()=>0);
  const distractors=options.filter(x=>x.word!=='abandon').map(x=>x.word);
  assert.deepEqual(new Set(distractors),new Set(['ability','climate','injury']));
}

{
  const duplicateMeaning={word:'giveup',translation:'v. 放弃'};
  const duplicateWord={word:'Abandon',translation:'n. 遗弃'};
  const options=buildChoiceOptions(answer,[[duplicateMeaning,duplicateWord,...pool]],fallback,4,()=>0);
  assert(!options.some(x=>x.word==='giveup'));
  assert(!options.some(x=>x.word==='Abandon'));
}

{
  const options=buildChoiceOptions(answer,[[answer]],fallback,4,()=>0);
  const words=options.map(x=>x.word);
  assert.equal(options.length,3);
  assert.deepEqual(new Set(words),new Set(['abandon','culture','economy']));
}

{
  const learned=[
    {word:'alpha',translation:'n. 甲'},
    {word:'bravo',translation:'n. 乙'},
    {word:'charlie',translation:'n. 丙'},
    {word:'delta',translation:'n. 丁'}
  ];
  const options=buildChoiceOptions(answer,[learned],fallback,4,()=>0);
  const distractors=options.filter(x=>x.word!=='abandon').map(x=>x.word);
  assert.deepEqual(new Set(distractors),new Set(['bravo','charlie','delta']));
}

{
  const learned=[
    {word:'alpha',translation:'n. 甲'},
    {word:'bravo',translation:'n. 乙'},
    {word:'charlie',translation:'n. 丙'},
    {word:'delta',translation:'n. 丁'},
    {word:'echo',translation:'n. 戊'},
    {word:'foxtrot',translation:'n. 己'}
  ];
  const options=buildChoiceOptions(answer,[learned],fallback,4,()=>0,['alpha','bravo','charlie']);
  const distractors=options.filter(x=>x.word!=='abandon').map(x=>x.word);
  assert(!distractors.includes('alpha'));
  assert(!distractors.includes('bravo'));
  assert(!distractors.includes('charlie'));
}

console.log('quiz-options tests passed');
