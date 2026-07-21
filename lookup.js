import{loadVocabulary,allWords,findWord,getState}from'./vocabulary-manager.js';
import{add}from'./learning-pool.js';
import{rootHint,keyPoint,nearWords,speak,cleanTranslation}from'./knowledge.js?v=6.0.0';
import{bindInteractiveEnglish,makeInteractiveText,sentenceAudioButton}from'./interactive-english.js?v=6.0.0';

const $=s=>document.querySelector(s);
await loadVocabulary();
bindInteractiveEnglish();
let current=null;

function relatedWordHtml(words){
  return words.length?`<div class="related-list">${words.map(x=>`<button class="related-word" type="button" data-word="${x.word}"><strong>${x.word}</strong><small>${cleanTranslation(x)}</small></button>`).join('')}</div>`:'暂无可靠近义关联';
}

function phraseHtml(p){
  return`<p><strong>${makeInteractiveText(p.phrase)}</strong>　${p.translation}</p>`;
}

function asList(value,key){
  if(Array.isArray(value))return value;
  return value&&typeof value==='object'&&value[key]?[value]:[];
}

function show(w){
  current=w;
  const rec=getState().records[w.word]||{},examples=asList(w.sentences,'sentence'),phrases=asList(w.phrases,'phrase'),near=nearWords(w,allWords());
  $('#detail').classList.remove('hidden');
  $('#detail').innerHTML=`<div class="toolbar"><div style="flex:1"><h2 class="word" data-lookup-word="${w.word}" style="font-size:clamp(2.4rem,10vw,5rem)">${w.word}</h2><p class="phonetic">美 /${w.us||'暂无'}/　英 /${w.uk||'暂无'}/</p></div><span class="chip">连续答对 ${rec.correctStreak||0}/3</span></div><h3>完整释义</h3><p class="meaning">${cleanTranslation(w)}</p><h3>高频考点</h3><p class="exam-point">${keyPoint(w)}</p><h3>词组搭配</h3><div>${phrases.length?phrases.map(phraseHtml).join(''):'暂无搭配数据'}</div><h3>对应例句</h3><div>${examples.length?examples.map(x=>`<div class="example-block"><p class="example">${sentenceAudioButton(x.sentence)}${makeInteractiveText(x.sentence,{highlight:[w.word]})}</p><p class="example-cn">${x.translation||''}</p></div>`).join(''):'暂无例句'}</div><h3>词根提示</h3><p>${rootHint(w.word)}</p><h3>近义/相关词</h3>${relatedWordHtml(near)}<div class="toolbar"><button class="btn secondary" data-speak="en-US">美音</button><button class="btn secondary" data-speak="en-GB">英音</button><button class="btn" id="addNow">加入今日学习池</button></div>`;
  $('#addNow').onclick=()=>add(w.word);
}

function search(){
  const q=$('#query').value.trim().toLowerCase();
  const exact=findWord(q);
  if(exact){show(exact);return}
  const hits=allWords().filter(w=>w.word.toLowerCase().includes(q)||(w.translation||'').includes(q)).slice(0,30);
  $('#results').innerHTML=hits.map(w=>`<button class="row option" data-word="${w.word}"><span><strong>${w.word}</strong><small>${cleanTranslation(w)}</small></span></button>`).join('')||'<div class="empty">没有找到</div>';
}

$('#search').onclick=search;
$('#query').onkeydown=e=>{if(e.key==='Enter')search()};
document.addEventListener('click',e=>{
  if(e.target.dataset.word){
    const w=findWord(e.target.dataset.word);
    if(w){show(w);speak(w.word)}
  }
  if(e.target.dataset.speak&&current)speak(current.word,e.target.dataset.speak);
});
