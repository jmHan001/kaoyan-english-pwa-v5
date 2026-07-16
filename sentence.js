import{loadVocabulary,findWord}from'./vocabulary-manager.js';
import{add}from'./learning-pool.js';
import{FIELD_KEYS,findDuplicateSentence,parseStructuredSentenceMaterial}from'./sentence-parser.mjs';
import{bindInteractiveEnglish,makeInteractiveText,sentenceAudioButton}from'./interactive-english.js';

const $=s=>document.querySelector(s);
const KEYS={sentence:'ky5_sentence',history:'ky5_sentence_history'};
const FIELD_LABELS={
  sentenceNumber:'句子编号',
  source:'来源',
  originalSentence:'原句',
  readingOrder:'阅读顺序',
  chunks:'意群切分',
  vocabulary:'核心词汇',
  mainClause:'句子主干',
  structureAnalysis:'句子结构',
  translation:'参考翻译',
  grammarNotes:'语法笔记',
  fixedExpressions:'固定搭配',
  userMistakes:'个人易错点',
  testResult:'毕业测试',
  masteryStatus:'掌握状态',
  unrecognized:'未识别内容'
};
let selected='',pendingImport=null,pendingDuplicate=null;

const GPT_OUTPUT_TEMPLATE=[
  '请把我接下来提供的英语长难句，严格按下面的课堂学习顺序分析。',
  '',
  '要求：',
  '1. 只输出【网页长难句资料】区块，不要解释、前言、Markdown 代码块或额外标题。',
  '2. 字段必须按下面顺序输出；不要改变英文原句的拼写、标点或大小写。',
  '3. 【阅读顺序】按阅读推进顺序编号，每行保留英文短语，并用“ = ”写中文理解。',
  '4. 【意群切分】只切分英文原句，按 1.、2.、3. 编号，不翻译、不改写。',
  '5. 【句子主干】写主语、谓语、宾语或表语；没有宾语时如实说明。',
  '6. 【句子结构】只分析真实存在的结构，不要猜测或补造。',
  '7. 无法确定的字段写“未识别”；【毕业测试】写“未测试”；【掌握状态】写“not_started”。',
  '',
  '【网页长难句资料】',
  '',
  '【句子编号】',
  '请保留我提供的编号；未提供则写 未编号',
  '',
  '【来源】',
  '请保留我提供的来源；未提供则写 未提供',
  '',
  '【原句】',
  '这里完整保留英语原句',
  '',
  '【阅读顺序】',
  '1. 英文阅读片段 = 对应中文理解',
  '2. 英文阅读片段 = 对应中文理解',
  '3. 英文阅读片段 = 对应中文理解',
  '',
  '【意群切分】',
  '1. 英文意群一',
  '2. 英文意群二',
  '3. 英文意群三',
  '',
  '【句子主干】',
  '主语 + 谓语 + 宾语/表语',
  '',
  '【句子结构】',
  '- 结构名称：对应英文部分 + 作用说明',
  '- 结构名称：对应英文部分 + 作用说明',
  '',
  '【核心词汇】',
  '- word：中文释义',
  '- phrase：中文释义',
  '',
  '【参考翻译】',
  '完整中文译文',
  '',
  '【语法笔记】',
  '1. 知识点',
  '2. 知识点',
  '',
  '【固定搭配】',
  '- expression = 中文含义',
  '',
  '【个人易错点】',
  '- 错误：未填写',
  '  正确：未填写',
  '  原因：未填写',
  '',
  '【毕业测试】',
  '未测试',
  '',
  '【掌握状态】',
  'not_started',
  '',
  '下面是需要分析的内容：',
  '【句子编号】',
  '（粘贴句子编号，可留空）',
  '',
  '【来源】',
  '（粘贴来源，可留空）',
  '',
  '【原句】',
  '（粘贴英文原句）'
].join('\\n');

await loadVocabulary();
bindInteractiveEnglish();

const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const saveJson=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=value=>String(value||'').split('\n').map(x=>x.trim()).filter(Boolean);
const fieldIds=[...FIELD_KEYS,'unrecognized'];
const labelOf=x=>x==='both'?'高考与考研共有':x==='gaokao'?'高考词':x==='kaoyan'?'考研词':'未收录';

function history(){return readJson(KEYS.history,[])}

function readForm(){
  const record={};
  for(const id of fieldIds)record[id]=$(`#${id}`)?.value?.trim()||'';
  return record;
}

function fillForm(record){
  for(const id of fieldIds){
    const el=$(`#${id}`);
    if(el)el.value=record?.[id]||'';
  }
  localStorage.setItem(KEYS.sentence,record?.originalSentence||'');
  renderPreview(record);
  renderSegments(record);
}

function clearForm(){
  fillForm({});
  $('#previewPanel').classList.add('hidden');
  $('#segments').innerHTML='<div class="empty">输入句子后开始分析</div>';
  $('#duplicateNotice').classList.add('hidden');
  $('#importNotice').classList.add('hidden');
}

function markWords(text){
  return makeInteractiveText(text);
}

function previewContent(key,value){
  if(!value)return'未识别';
  if(['originalSentence','readingOrder','chunks','mainClause','structureAnalysis','vocabulary','grammarNotes','fixedExpressions'].includes(key)){
    const audio=key==='originalSentence'?sentenceAudioButton(value):'';
    return`${audio}${makeInteractiveText(value)}`;
  }
  return esc(value).replace(/\n/g,'<br>');
}

function renderPreview(record=readForm()){
  const sections=[
    'originalSentence',
    'readingOrder',
    'chunks',
    'mainClause',
    'structureAnalysis',
    'vocabulary',
    'translation',
    'grammarNotes',
    'userMistakes',
    'masteryStatus'
  ];
  $('#previewPanel').classList.remove('hidden');
  $('#previewPanel').innerHTML=`<h2>解析预览</h2>${sections.map(key=>`<section><strong>${FIELD_LABELS[key]}</strong><p>${previewContent(key,record[key])}</p></section>`).join('')}`;
}

function renderSegments(record=readForm()){
  const chunkLines=lines(record.chunks).length?lines(record.chunks):[record.originalSentence].filter(Boolean);
  $('#segments').innerHTML=chunkLines.length?chunkLines.map((text,index)=>{const clean=text.replace(/^[\-\u2022①-⑳]?\s*\d*[.)、]?\s*/,'');return`<p><strong>意群 ${index+1}</strong>${sentenceAudioButton(clean)}<br>${markWords(clean)}</p>`}).join(''):'<div class="empty">输入句子后开始分析</div>';
}

function renderHistory(){
  const items=history();
  $('#history').innerHTML=items.length?items.slice(0,30).map(item=>`<button class="history-item" data-history="${esc(item.id)}"><strong>${esc(item.originalSentence||item.sentence||'未命名长难句')}</strong><small>${esc(item.sentenceNumber||'无编号')} · ${esc(item.source||'无来源')} · ${new Date(item.at).toLocaleString('zh-CN')}</small></button>`).join(''):'<div class="empty">还没有保存记录</div>';
}

function showNotice(message,type=''){
  const el=$('#importNotice');
  el.textContent=message;
  el.className=`notice ${type}`.trim();
}

function applyParsedResult(parsed){
  pendingImport=parsed.record;
  const duplicate=findDuplicateSentence(history(),parsed.record.originalSentence);
  if(duplicate){
    pendingDuplicate=duplicate;
    $('#duplicateText').textContent=duplicate.originalSentence||duplicate.sentence||'已有记录';
    $('#duplicateModal').classList.remove('hidden');
    return;
  }
  fillForm(parsed.record);
  showNotice(parsed.warnings.length?`已导入，但存在提示：${parsed.warnings.join('；')}`:'已导入剪贴板内容，请检查预览后手动保存。');
}

async function importClipboard(){
  let text='';
  try{
    text=await navigator.clipboard.readText();
  }catch{
    showNotice('浏览器拒绝剪贴板权限。请允许权限，或手动复制后重试。','warn');
    return;
  }
  if(!text.trim()){
    showNotice('剪贴板为空。请先复制 ChatGPT 输出的【网页长难句资料】。','warn');
    return;
  }
  const parsed=parseStructuredSentenceMaterial(text);
  if(!parsed.ok){
    fillForm(parsed.record);
    showNotice(parsed.errors.join('；'),'warn');
    return;
  }
  applyParsedResult(parsed);
}

async function copyGptTemplate(){
  try{
    await navigator.clipboard.writeText(GPT_OUTPUT_TEMPLATE);
    showNotice('已复制 GPT 输出模板。把它发给 GPT，再补上原句；收到结果后复制并点击“从剪贴板导入”。');
  }catch{
    showNotice('无法写入剪贴板。请允许浏览器剪贴板权限后重试。','warn');
  }
}

function saveAnalysis(){
  const record=readForm();
  if(!record.originalSentence){
    showNotice('无法保存：缺少【原句】字段。','warn');
    return;
  }
  const items=history().filter(x=>findDuplicateSentence([x],record.originalSentence)===null);
  items.unshift({...record,id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,at:Date.now()});
  saveJson(KEYS.history,items.slice(0,100));
  localStorage.setItem(KEYS.sentence,record.originalSentence);
  showNotice('已保存。后续复习、测试和掌握状态由网页本地记录管理。');
  renderHistory();
}

$('#importClipboard').onclick=importClipboard;
$('#clearImport').onclick=clearForm;
$('#copyGptTemplate').onclick=copyGptTemplate;
$('#previewImport').onclick=()=>{const record=readForm();renderPreview(record);renderSegments(record)};
$('#saveAnalysis').onclick=saveAnalysis;
$('#sample').onclick=()=>{
  const sample=`【网页长难句资料】

【句子编号】
Exercise 1 - Sentence 03

【来源】
2011 英语二完形

【原句】
When the work is well done, a climate of accident-free operations is established where time lost due to injuries is kept at a minimum.

【阅读顺序】
1. When the work is well done, = 当工作完成得很好时，
2. a climate of accident-free operations is established = 一种无事故运行的氛围会被建立起来，
3. where time lost due to injuries is kept at a minimum. = 在这种氛围中，因受伤损失的时间被控制在最低限度。

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
当工作做得很好时，就会形成一种无事故运行的氛围，在这种氛围中，因受伤而损失的时间会被降到最低。

【语法笔记】
1. When 引导时间状语从句。
2. where 引导定语从句，修饰 climate。

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
  applyParsedResult(parseStructuredSentenceMaterial(sample));
};

$('#viewDuplicate').onclick=()=>{
  $('#duplicateModal').classList.add('hidden');
  renderHistory();
  $('#duplicateNotice').textContent='已定位到已有记录列表。请选择历史记录查看，或点击“覆盖表单内容”重新导入。';
  $('#duplicateNotice').classList.remove('hidden');
  $('#history').scrollIntoView({behavior:'smooth',block:'center'});
};
$('#overwriteForm').onclick=()=>{
  $('#duplicateModal').classList.add('hidden');
  fillForm(pendingImport);
  showNotice('已覆盖表单内容，但没有覆盖已保存记录。检查后可手动保存。');
};
$('#cancelImport').onclick=()=>{
  $('#duplicateModal').classList.add('hidden');
  pendingImport=null;
  pendingDuplicate=null;
  showNotice('已取消导入。');
};

document.addEventListener('click',e=>{
  const historyButton=e.target.closest?.('[data-history]');
  if(historyButton){
    const item=history().find(x=>x.id===historyButton.dataset.history);
    if(item)fillForm(item);
  }
  const w=e.target.dataset.word;
  if(w){
    selected=w;
    const x=findWord(w);
    $('#mword').textContent=w;
    $('#mmeaning').textContent=x?`${x.translation} · ${labelOf(x.source)}`:'当前词库未收录';
    $('#add').disabled=!x;
    $('#modal').classList.remove('hidden');
  }
  const lang=e.target.dataset.voice;
  if(lang){
    const u=new SpeechSynthesisUtterance(selected);
    u.lang=lang;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
});

for(const id of fieldIds){
  const el=$(`#${id}`);
  if(el)el.addEventListener('input',()=>{renderPreview(readForm());renderSegments(readForm())});
}

$('#clearHistory').onclick=()=>{
  if(confirm('确定清空已保存长难句历史？')){localStorage.removeItem(KEYS.history);renderHistory()}
};
$('#close').onclick=()=>$('#modal').classList.add('hidden');
$('#add').onclick=()=>{add(selected);$('#modal').classList.add('hidden')};

const last=localStorage.getItem(KEYS.sentence);
if(last)$('#originalSentence').value=last;
renderPreview(readForm());
renderSegments(readForm());
renderHistory();
