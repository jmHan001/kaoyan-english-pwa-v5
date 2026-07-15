import{loadVocabulary,findWord}from'./vocabulary-manager.js';
import{add}from'./learning-pool.js';

const $=s=>document.querySelector(s);
const KEYS={sentence:'ky5_sentence',context:'ky5_sentence_context',history:'ky5_sentence_history'};
let selected='',lastAnalysis=null;

await loadVocabulary();
$('#input').value=localStorage.getItem(KEYS.sentence)||'';
$('#contextInput').value=localStorage.getItem(KEYS.context)||'';

const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const saveJson=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wordCount=text=>(String(text).match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]).length;
const labelOf=x=>x==='both'?'高考与考研共有':x==='gaokao'?'高考词':x==='kaoyan'?'考研词':'未收录';

function segmentRole(text,index){
  if(index===0)return'主干候选';
  if(/\b(although|though|while|whereas|even if|even though)\b/i.test(text))return'让步或对比';
  if(/\b(because|since|as|therefore|thus|so that)\b/i.test(text))return'因果关系';
  if(/\b(which|that|who|whom|whose|where|when)\b/i.test(text))return'从句修饰';
  if(/\b(if|unless|provided)\b/i.test(text))return'条件关系';
  if(/\b(and|or|but|however|rather than)\b/i.test(text))return'并列或转折';
  return'补充成分';
}

function splitSentence(text){
  return String(text||'').trim().split(/(?<=[,;:.!?])\s+|\s+(?=(?:although|because|while|which|that|who|whom|whose|when|where|if|unless|but|and|or|however|therefore|rather than)\b)/i).map(x=>x.trim()).filter(Boolean);
}

function markWords(text){
  return esc(text).replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g,word=>{
    const x=findWord(word);
    return`<span class="token ${x?.source||'unknown'}" data-word="${esc(word)}">${esc(word)}</span>`;
  });
}

function extractLongSentences(text){
  const raw=String(text||'').replace(/\r/g,'\n');
  const chunks=raw.split(/(?<=[.!?])\s+|\n+/).map(x=>x.trim()).filter(Boolean);
  const candidates=[];
  for(const chunk of chunks){
    const cleaned=chunk.replace(/^(user|assistant|ChatGPT|我|你|用户|助手)\s*[:：-]\s*/i,'').trim();
    if(!/[A-Za-z]/.test(cleaned))continue;
    const count=wordCount(cleaned);
    if(count>=10)candidates.push(cleaned);
  }
  return [...new Set(candidates)].slice(0,20);
}

function renderCandidates(list){
  const box=$('#candidates');
  if(!list.length){box.classList.add('hidden');box.innerHTML='';return}
  box.classList.remove('hidden');
  box.innerHTML=`<h3>提取到 ${list.length} 个英文长句</h3>${list.map((text,i)=>`<button class="sentence-candidate" data-candidate="${i}"><strong>${i+1}</strong><span>${esc(text)}</span><small>${wordCount(text)} 词</small></button>`).join('')}`;
}

function analyze(){
  const text=$('#input').value.trim();
  localStorage.setItem(KEYS.sentence,text);
  localStorage.setItem(KEYS.context,$('#contextInput').value.trim());
  const parts=splitSentence(text);
  lastAnalysis={sentence:text,context:$('#contextInput').value.trim(),segments:parts.map((part,index)=>({role:segmentRole(part,index),text:part})),at:Date.now()};
  $('#segments').innerHTML=lastAnalysis.segments.map(seg=>`<p><strong>${esc(seg.role)}</strong><br>${markWords(seg.text)}</p>`).join('')||'<div class="empty">请输入英文句子</div>';
}

function history(){
  return readJson(KEYS.history,[]);
}

function renderHistory(){
  const items=history();
  $('#history').innerHTML=items.length?items.slice(0,30).map(item=>`<button class="history-item" data-history="${esc(item.id)}"><strong>${esc(item.sentence)}</strong><small>${new Date(item.at).toLocaleString('zh-CN')} · ${item.segments?.length||0} 段 · ${wordCount(item.sentence)} 词</small></button>`).join(''):'<div class="empty">还没有保存记录</div>';
}

function saveAnalysis(){
  if(!lastAnalysis)analyze();
  if(!lastAnalysis?.sentence)return;
  const items=history().filter(x=>x.sentence!==lastAnalysis.sentence);
  items.unshift({...lastAnalysis,id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`});
  saveJson(KEYS.history,items.slice(0,80));
  $('#importNotice').textContent='已保存当前长难句、聊天上下文和拆分解析。';
  $('#importNotice').classList.remove('hidden');
  renderHistory();
}

$('#analyze').onclick=analyze;
$('#saveAnalysis').onclick=saveAnalysis;
$('#sample').onclick=()=>{
  $('#contextInput').value='ChatGPT: Please analyze this sentence for exam reading.';
  $('#input').value='Although technology has made information easier to obtain, the ability to judge which sources are relevant remains essential for students who wish to develop an independent perspective.';
  analyze();
};
$('#readClipboard').onclick=async()=>{
  try{
    const text=await navigator.clipboard.readText();
    $('#contextInput').value=text;
    localStorage.setItem(KEYS.context,text);
    const list=extractLongSentences(text);
    renderCandidates(list);
    if(list[0]){$('#input').value=list[0];analyze()}
    $('#importNotice').textContent=list.length?`已从剪贴板读取，并提取到 ${list.length} 个英文长句。`:'已读取剪贴板，但没有发现 10 词以上英文长句。';
  }catch{
    $('#importNotice').textContent='浏览器没有允许读取剪贴板。请手动粘贴聊天内容，再点“提取英文长句”。';
  }
  $('#importNotice').classList.remove('hidden');
};
$('#extractSentences').onclick=()=>{
  const text=$('#contextInput').value.trim();
  localStorage.setItem(KEYS.context,text);
  const list=extractLongSentences(text);
  renderCandidates(list);
  if(list[0]){$('#input').value=list[0];analyze()}
  $('#importNotice').textContent=list.length?`提取到 ${list.length} 个英文长句。点击候选句可切换。`:'没有发现 10 词以上英文长句。';
  $('#importNotice').classList.remove('hidden');
};
$('#clearContext').onclick=()=>{
  $('#contextInput').value='';
  $('#input').value='';
  localStorage.removeItem(KEYS.context);
  localStorage.removeItem(KEYS.sentence);
  $('#candidates').classList.add('hidden');
  $('#segments').innerHTML='<div class="empty">输入句子后开始分析</div>';
};
$('#clearHistory').onclick=()=>{
  if(confirm('确定清空已保存长难句历史？')){localStorage.removeItem(KEYS.history);renderHistory()}
};

document.addEventListener('click',e=>{
  const candidate=e.target.closest?.('[data-candidate]');
  if(candidate){
    const list=extractLongSentences($('#contextInput').value);
    $('#input').value=list[Number(candidate.dataset.candidate)]||'';
    analyze();
  }
  const historyButton=e.target.closest?.('[data-history]');
  if(historyButton){
    const item=history().find(x=>x.id===historyButton.dataset.history);
    if(item){$('#contextInput').value=item.context||'';$('#input').value=item.sentence||'';lastAnalysis=item;analyze()}
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

$('#close').onclick=()=>$('#modal').classList.add('hidden');
$('#add').onclick=()=>{add(selected);$('#modal').classList.add('hidden')};
if($('#input').value)analyze();
if($('#contextInput').value)renderCandidates(extractLongSentences($('#contextInput').value));
renderHistory();
