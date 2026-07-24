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

const conduct={word:'conduct',translation:'v. 导电；带领；n. 进行；行为；实施'};
assert.equal(matchCoreMeaning('进行',conduct).correct,true,'a listed non-primary sense must be accepted');
assert.equal(matchCoreMeaning('开展',conduct).correct,true,'a clear related Chinese meaning must be accepted');
assert.equal(matchCoreMeaning('指挥',conduct).correct,true,'normalization must not strip the meaningful 指 character');
assert.equal(matchCoreMeaning('天气',conduct).correct,false,'fuzzy matching must not accept unrelated meanings');

console.log('meaning recall tests passed');
