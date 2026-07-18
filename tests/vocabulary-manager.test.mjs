import assert from 'node:assert/strict';

const gaokao=[
  {word:'repeat',translation:'高考释义'},
  {word:'repeat',translation:'重复条目'},
  {word:'shared',translation:'共有释义'},
  {word:'clean',translation:'干净\ue072',us:'kliːn\u200b'}
];
const kaoyan=[
  {word:'exam',translation:'考研释义'},
  {word:'exam',translation:'重复条目'},
  {word:'shared',translation:'考研释义'},
  {word:'resumé',translation:'简历'}
];

globalThis.fetch=async url=>({
  ok:true,
  json:async()=>String(url).includes('gaokao')?gaokao:kaoyan
});

const manager=await import(`../vocabulary-manager.js?test=${Date.now()}`);
const words=await manager.loadVocabulary();
const byWord=new Map(words.map(item=>[item.word,item]));

assert.equal(words.length,5,'同一词库内部重复词应先去重');
assert.equal(byWord.get('repeat').source,'gaokao','高考库内部重复不能误标为共有');
assert.equal(byWord.get('exam').source,'kaoyan','考研库内部重复不能误标为共有');
assert.equal(byWord.get('shared').source,'both','跨词库重复应标记为共有');
assert.equal(byWord.get('clean').translation,'干净','应清除词义中的私用控制字符');
assert.equal(byWord.get('clean').us,'kliːn','应清除音标中的零宽字符');
assert.equal(manager.findWord('resumé')?.translation,'简历','含重音符号的原词应可直接查询');

console.log('vocabulary-manager tests passed');
