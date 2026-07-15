import assert from'node:assert/strict';
import{FIELD_KEYS,findDuplicateSentence,normalizeSentence,parseStructuredSentenceMaterial}from'../sentence-parser.mjs';

assert.deepEqual(FIELD_KEYS.slice(0,8),[
  'sentenceNumber','source','originalSentence','readingOrder','chunks','mainClause','structureAnalysis','vocabulary'
]);

const fullText=`闲聊内容
【网页长难句资料】

【句子编号】
Exercise 1 - Sentence 03

【来源】
2011 英语二完形

【原句】
When the work is well done, a climate of accident-free operations is established where time lost due to injuries is kept at a minimum.

【阅读顺序】
1. When the work is well done, = 当工作完成得很好时，
2. a climate of accident-free operations is established = 一种无事故运行的氛围会被建立起来。

【意群切分】
1. When the work is well done,
2. a climate of accident-free operations is established
3. where time lost due to injuries is kept at a minimum.

【核心词汇】
- climate：氛围
- operation：运行

【句子主干】
a climate is established

【句子结构】
- 时间状语：When the work is well done
- 定语从句：where time lost due to injuries is kept at a minimum
- 过去分词短语：lost due to injuries

【参考翻译】
当工作做得很好时，就会形成一种无事故运行的氛围。

【语法笔记】
1. When 引导时间状语从句。
2. where 引导定语从句。

【固定搭配】
- keep ... at a minimum = 把……保持在最低限度

【个人易错点】
- 错误：把 where 理解为地点状语
  正确：where 修饰抽象名词 climate
  原因：抽象地点也可以用 where 引导定语从句

【毕业测试】
得分：8/10

【掌握状态】
completed`;

{
  const parsed=parseStructuredSentenceMaterial(fullText);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.record.sentenceNumber,'Exercise 1 - Sentence 03');
  assert.equal(parsed.record.source,'2011 英语二完形');
  assert.match(parsed.record.originalSentence,/accident-free operations/);
  assert.match(parsed.record.readingOrder,/当工作完成得很好时/);
  assert.match(parsed.record.chunks,/1\. When the work/);
  assert.match(parsed.record.structureAnalysis,/过去分词短语/);
  assert.match(parsed.record.userMistakes,/原因：/);
  assert.equal(parsed.record.masteryStatus,'completed');
}

{
  const parsed=parseStructuredSentenceMaterial(`【网页长难句资料】
【原句】
This is a long enough sentence that should still be imported even when several fields are missing.
【参考翻译】
这是译文。`);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.record.sentenceNumber,'');
  assert.match(parsed.warnings.join('；'),/缺少【句子编号】/);
}

{
  const parsed=parseStructuredSentenceMaterial(`【网页长难句资料】
【掌握状态】
completed
【句子结构】
① 定语从句：which ...
• 不定式短语：to improve ...
【原句】
Students who review sentences carefully are more likely to notice how grammar shapes meaning.
【句子编号】
Exercise 2 - Sentence 01`);
  assert.equal(parsed.record.masteryStatus,'completed');
  assert.equal(parsed.record.sentenceNumber,'Exercise 2 - Sentence 01');
  assert.match(parsed.record.structureAnalysis,/不定式短语/);
}

{
  const parsed=parseStructuredSentenceMaterial(`【网页长难句资料】
【原句】
Although the evidence was incomplete, the committee decided that the proposal should be discussed in public.
【句子结构】
- 让步状语从句：
  Although the evidence was incomplete
- 宾语从句：
  that the proposal should be discussed in public
【未定义字段】
需要人工处理`);
  assert.match(parsed.record.structureAnalysis,/Although the evidence/);
  assert.match(parsed.record.unrecognized,/未定义字段/);
}

{
  const parsed=parseStructuredSentenceMaterial(`【网页长难句资料】
【原句】
“The change”，which many people had expected，was finally accepted by the committee.
【核心词汇】
- change：变化`);
  assert.equal(normalizeSentence(parsed.record.originalSentence),'"the change",which many people had expected,was finally accepted by the committee.');
}

{
  const records=[{originalSentence:'"The change" which many people had expected was accepted.'}];
  const duplicate=findDuplicateSentence(records,'“The  change”   which many people had expected was accepted.');
  assert.equal(duplicate,records[0]);
}

{
  const parsed=parseStructuredSentenceMaterial('没有资料区块');
  assert.equal(parsed.ok,false);
  assert.match(parsed.errors.join('；'),/未找到/);
}

console.log('sentence-parser tests passed');
