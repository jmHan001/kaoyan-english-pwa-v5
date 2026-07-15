import{loadVocabulary,findWord}from'./vocabulary-manager.js';
import{add}from'./learning-pool.js';
import{FIELD_KEYS,findDuplicateSentence,parseStructuredSentenceMaterial}from'./sentence-parser.mjs';

const $=s=>document.querySelector(s);
const KEYS={sentence:'ky5_sentence',history:'ky5_sentence_history'};
const FIELD_LABELS={
  sentenceNumber:'句子编号',
  source:'来源',
  originalSentence:'原句',
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

await loadVocabulary();

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
  return esc(text).replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g,word=>{
    const x=findWord(word);
    return`<span class="token ${x?.source||'unknown'}" data-word="${esc(word)}">${esc(word)}</span>`;
  });
}

function renderPreview(record=readForm()){
  const sections=[
    'originalSentence',
    'chunks',
    'vocabulary',
    'mainClause',
    'structureAnalysis',
    'translation',
    'grammarNotes',
    'userMistakes',
    'masteryStatus'
  ];
  $('#previewPanel').classList.remove('hidden');
  $('#previewPanel').innerHTML=`<h2>解析预览</h2>${sections.map(key=>`<section><strong>${FIELD_LABELS[key]}</strong><p>${record[key]?esc(record[key]).replace(/\n/g,'<br>'):'未识别'}</p></section>`).join('')}`;
}

function renderSegments(record=readForm()){
  const chunkLines=lines(record.chunks).length?lines(record.chunks):[record.originalSentence].filter(Boolean);
  $('#segments').innerHTML=chunkLines.length?chunkLines.map((text,index)=>`<p><strong>意群 ${index+1}</strong><br>${markWords(text.replace(/^[\-\u2022①-⑳]?\s*\d*[.)、]?\s*/,''))}</p>`).join(''):'<div class="empty">输入句子后开始分析</div>';
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
