import{findWord}from'./vocabulary-manager.js';
import{add}from'./learning-pool.js';
import{rootHint}from'./knowledge.js';
import{playPronunciation as speak}from'./audio-engine.js?v=5.6.17';

const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeWord='';

function lookup(raw){
  const cleaned=String(raw||'').replace(/^['-]+|['-]+$/g,'').replace(/'s$/i,'');
  return findWord(cleaned)||findWord(cleaned.toLowerCase())||findWord(cleaned.replace(/s$/i,''));
}

function sourceLabel(source){
  if(source==='both')return'高考与考研共有';
  if(source==='gaokao')return'高考词';
  if(source==='kaoyan')return'考研词';
  return'未收录';
}

export function makeInteractiveText(text,{highlight=[]}={}){
  const focus=new Set(highlight.map(x=>String(x).toLowerCase()));
  const renderPlain=part=>part.split(/([A-Za-z]+(?:[-'][A-Za-z]+)*)/g).map(piece=>{
    if(!/^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(piece))return esc(piece);
    const item=lookup(piece);
    const key=String(item?.word||piece).toLowerCase();
    const classes=['token',item?.source||'unknown','interactive-token'];
    if(focus.has(key)||focus.has(String(piece).toLowerCase()))classes.push('focus');
    return`<button type="button" class="${classes.join(' ')}" data-lookup-word="${esc(piece)}" title="点按听发音和看释义">${esc(piece)}</button>`;
  }).join('');
  return String(text||'').split(/(<[^>]*>)/g).map(part=>/^<[^>]*>$/.test(part)?esc(part):renderPlain(part)).join('').replace(/\n/g,'<br>');
}

export function sentenceAudioButton(text,label='朗读句子'){
  const value=String(text||'').trim();
  if(!value)return'';
  return`<span class="sentence-actions"><button type="button" class="mini-speak" data-speak-lang="en-US" data-speak-text="${esc(value)}">${esc(label)}</button><button type="button" class="mini-speak ghost" data-speak-lang="en-GB" data-speak-text="${esc(value)}">英音</button></span>`;
}

function ensureModal(){
  let modal=document.getElementById('interactiveWordModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='interactiveWordModal';
  modal.className='modal hidden';
  modal.innerHTML=`<div class="modal-card word-pop-card">
<button class="iconbtn word-pop-close" type="button" aria-label="关闭">×</button>
<div class="word-pop-head">
<h2 id="iwWord"></h2>
<span class="chip" id="iwSource"></span>
</div>
<p class="phonetic" id="iwPhonetic"></p>
<section class="word-pop-section">
<strong>词义</strong>
<p id="iwMeaning"></p>
</section>
<section class="word-pop-section">
<strong>词根/记忆提示</strong>
<p id="iwRoot"></p>
</section>
<div class="toolbar">
<button class="btn secondary" type="button" data-mini-voice="en-US">美音</button>
<button class="btn secondary" type="button" data-mini-voice="en-GB">英音</button>
<button class="btn" type="button" id="iwAdd">加入学习池</button>
</div>
</div>`;
  document.body.append(modal);
  return modal;
}

function showWord(raw){
  const modal=ensureModal();
  const item=lookup(raw);
  activeWord=item?.word||String(raw||'').trim();
  document.getElementById('iwWord').textContent=activeWord;
  document.getElementById('iwSource').textContent=sourceLabel(item?.source);
  document.getElementById('iwPhonetic').textContent=item?`美 /${item.us||'暂无'}/　英 /${item.uk||'暂无'}/`:'当前词库未收录';
  document.getElementById('iwMeaning').textContent=item?.translation||'当前词库未收录，可以先在查词页补充或之后加入自定义词。';
  document.getElementById('iwRoot').textContent=item?rootHint(item.word):'未收录词暂时没有词根提示。';
  document.getElementById('iwAdd').disabled=!item;
  modal.classList.remove('hidden');
  speak(activeWord,'en-US');
}

export function bindInteractiveEnglish(root=document){
  if(root.__interactiveEnglishBound)return;
  root.__interactiveEnglishBound=true;
  root.addEventListener('click',e=>{
    const wordButton=e.target.closest?.('[data-lookup-word]');
    if(wordButton){
      showWord(wordButton.dataset.lookupWord);
      return;
    }
    const sentenceButton=e.target.closest?.('[data-speak-text]');
    if(sentenceButton){
      speak(sentenceButton.dataset.speakText,sentenceButton.dataset.speakLang||'en-US');
      return;
    }
    const voice=e.target.closest?.('[data-mini-voice]');
    if(voice&&activeWord){
      speak(activeWord,voice.dataset.miniVoice);
      return;
    }
    if(e.target.closest?.('#iwAdd')&&activeWord){
      add(activeWord);
      ensureModal().classList.add('hidden');
      return;
    }
    if(e.target.closest?.('.word-pop-close')||e.target.id==='interactiveWordModal'){
      ensureModal().classList.add('hidden');
    }
  });
}
