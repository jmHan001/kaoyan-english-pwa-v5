import assert from'node:assert/strict';

globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const{acceptedMeanings,learningMeaning,matchCoreMeaning}=await import('../knowledge.js');

const abundant={word:'abundant',translation:'adj. 丰富的；充裕的；大量的'};
assert.deepEqual(acceptedMeanings(abundant).map(x=>x.normalized),['丰富','充裕','大量']);
assert.equal(matchCoreMeaning('丰富',abundant).correct,true);
assert.equal(matchCoreMeaning('非常丰富',abundant).correct,true);
assert.equal(matchCoreMeaning('稀少',abundant).correct,false);
assert.equal(matchCoreMeaning('',abundant).correct,false);

const abandon={word:'abandon',translation:'n. 放任；狂热；v. 遗弃；放弃'};
assert.equal(matchCoreMeaning('放弃',abandon).correct,true);
assert.equal(matchCoreMeaning('遗弃',abandon).correct,true);

const model={word:'model',translation:'n. 模型；典型；模范；v. 模拟；塑造'};
assert.equal(learningMeaning(model),'n. 模型','first learning should use the dictionary-leading core sense instead of always preferring verbs');

console.log('meaning recall tests passed');
