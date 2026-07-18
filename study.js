import{loadVocabulary,findWord,allWords,getState,saveState}from'./vocabulary-manager.js';
import{getPool}from'./learning-pool.js';
import{rate,dueWords,wrongWords,slayWord}from'./review-manager.js?v=5.7.5';
import{rootHint,keyPoint,nearWords,cleanTranslation,coreTranslation}from'./knowledge.js?v=5.6.25';
import{buildChoiceOptions}from'./quiz-options.js?v=5.7.3';
import{bindInteractiveEnglish,makeInteractiveText,sentenceAudioButton}from'./interactive-english.js?v=5.6.17';
import{playPronunciation,warmSpeechVoices}from'./audio-engine.js?v=5.6.23';

const $=s=>document.querySelector(s),label={gaokao:'高考词',kaoyan:'考研词',both:'高考与考研共有'};
let pool,queue=[],index=0,currentOptions=[],recentDistractors=[],answered=false,reviewMode=false,quizMode=false,quizScore=0,quizResults=[],quizSaved=false;
const reviewOnlyIndexes=new Set();

const params=new URLSearchParams(location.search);
const mode=params.get('mode')||'today';
const today=()=>new Date().toISOString().slice(0,10);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function current(){return findWord(queue[index])}
function wordsFromList(words){const seen=new Set(),items=[];for(const word of words||[]){const item=typeof word==='string'?findWord(word):word;if(item&&!seen.has(item.word)){seen.add(item.word);items.push(item)}}return items}
function learnedOptionWords(){const state=getState();return wordsFromList(Object.entries(state.records||{}).filter(([,record])=>record?.drawn||record?.lastSeen||record?.level||record?.errors).map(([word])=>word))}
function poolOptionWords(){return wordsFromList(pool?.items||[])}
function reviewOptionWords(){return wordsFromList([...wrongWords(),...dueWords()])}
function makeOptions(word){const options=buildChoiceOptions(word,[learnedOptionWords(),poolOptionWords(),reviewOptionWords()],allWords(),4,Math.random,recentDistractors);recentDistractors=[...options.filter(item=>item?.word!==word.word).map(item=>item.word),...recentDistractors].slice(0,12);return options}
function optionText(value){const text=String(value||'暂无释义').replace(/\s+/g,' ').trim();return text.length>82?`${text.slice(0,82)}…`:text}
function chunks(word){const parts=word.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]*[aeiouy])|[^aeiouy]*$)/gi);return parts?.length>1?parts.join(' · '):word}
function favoriteWords(){const state=getState();return Object.entries(state.records||{}).filter(([,record])=>record?.favorite).map(([word])=>word)}
function learnedWords(view='all'){const state=getState();return Object.entries(state.records||{}).filter(([,record])=>{const known=record?.drawn||record?.lastSeen||record?.level||record?.errors||record?.favorite,mastered=record?.tailStage||record?.level>=4;return !record?.slain&&known&&(view==='all'||(view==='mastered'?mastered:!mastered))}).sort((a,b)=>(b[1].lastSeen||0)-(a[1].lastSeen||0)).map(([word])=>word)}
function quizCandidates(){const state=getState(),seen=new Set(),items=[];for(const word of pool?.items||[]){const w=findWord(word);if(w&&!state.records[w.word]?.slain&&!seen.has(w.word)){seen.add(w.word);items.push(w.word)}}for(const word of [...wrongWords(),...dueWords()]){const w=findWord(word);if(w&&!state.records[w.word]?.slain&&!seen.has(w.word)){seen.add(w.word);items.push(w.word)}}return items}
function quizBook(){try{return JSON.parse(localStorage.getItem('ky5_quiz')||'{}')}catch{return{}}}
function saveQuizAttempt(){if(!quizMode||quizSaved)return;const book=quizBook(),wrong=quizResults.filter(x=>!x.correct),day=today();book[day]={date:day,attempts:[...(book[day]?.attempts||[]),{id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,at:Date.now(),score:quizScore,total:quizResults.length,wrong:wrong.map(x=>x.word)}]};localStorage.setItem('ky5_quiz',JSON.stringify(book));quizSaved=true}
function setFavorite(word,value){if(!word)return;const state=getState(),item=findWord(word),old=state.records[word]||{};state.records[word]={...old,source:item?.source||old.source,drawn:old.drawn||!!item,favorite:!!value};saveState(state);updateFavoriteButton()}
function updateFavoriteButton(){const w=current(),button=$('#favoriteToggle');if(!button)return;if(!w){button.classList.add('hidden');return}const active=!!getState().records[w.word]?.favorite;button.classList.remove('hidden');button.classList.toggle('active',active);button.textContent=active?'★':'☆';button.title=active?'取消收藏重点单词':'收藏重点单词';button.setAttribute('aria-pressed',String(active))}
function updateSlayButton(){const button=$('#slayToggle');if(!button)return;button.classList.toggle('hidden',quizMode||!current())}
function todayDone(word){return getState().records[word]?.todayDoneDate===today()}
function setPoolCompleted(word,done){if(!word)return;pool=getPool();const completed=new Set(pool.completed||[]);if(done)completed.add(word);else completed.delete(word);pool.completed=[...completed];localStorage.setItem('ky5_pool',JSON.stringify(pool));const state=getState(),item=findWord(word),old=state.records[word]||{},next={...old,source:item?.source||old.source};if(done){next.todayDoneDate=today();if(old.slain)next.slainCompletedToday=true}else if(next.todayDoneDate===today())delete next.todayDoneDate;state.records[word]=next;saveState(state)}
function repairTodayPool(){if(!pool?.items?.length)return;const completed=new Set(pool.completed||[]);let changed=false;for(const word of pool.items){if(todayDone(word)&&!completed.has(word)){completed.add(word);changed=true}}if(changed){pool.completed=[...completed];localStorage.setItem('ky5_pool',JSON.stringify(pool))}}
function relatedWordHtml(words){return words.length?`<div class="related-list">${words.map(x=>`<button class="related-word" type="button" data-lookup-word="${x.word}"><strong>${x.word}</strong><small>${cleanTranslation(x)}</small></button>`).join('')}</div>`:'<p>暂无可靠近义关联</p>'}
function renderChoices(word){currentOptions=makeOptions(word);const wrap=$('#choices');wrap.innerHTML='';currentOptions.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.className='choice-option';button.dataset.choice=String(i);const key=document.createElement('span');key.className='choice-key';key.textContent=String.fromCharCode(65+i);const text=document.createElement('span');text.textContent=optionText(coreTranslation(item));button.append(key,text);wrap.append(button)})}

function finishStudy(message){
  sessionStorage.setItem('ky5_last_study_message',message);
  location.href='index.html';
}

function finishQuizStudy(){
  saveQuizAttempt();
  const total=quizResults.length||queue.length,rate=total?Math.round(quizScore/total*100):0,wrong=quizResults.filter(x=>!x.correct).length;
  finishStudy(`单词小测完成：${quizScore}/${total}，正确率 ${rate}%。${wrong?`错 ${wrong} 个，已进入错词回炉。`:'这组全对，很稳。'}`);
}

function render(){
  const w=current();
  answered=false;
  $('#memoryPack').classList.add('hidden');
  $('#recallCue').classList.remove('hidden');
  $('#choiceFeedback').classList.add('hidden');
  $('#nextWord').classList.add('hidden');
  $('#reveal').classList.remove('hidden');
  if(!w){
    if(quizMode){finishQuizStudy();return}
    finishStudy(reviewMode?'本组背词已完成，已回到主页。':'今日背词已完成，已回到主页。');
    return;
  }
  $('#card').classList.remove('hidden');
  $('#word').textContent=w.word;
  $('#word').dataset.lookupWord=w.word;
  $('#meaning').textContent=coreTranslation(w);
  $('#fullMeaning').textContent=cleanTranslation(w);
  $('#source').textContent=label[w.source]||'自定义词';
  const rec=getState().records[w.word]||{};
  $('#memoryBadge').textContent=rec.tailStage?'长时记忆尾期':`连续正确 ${rec.correctStreak||0}/3`;
  $('#memoryBadge').classList.toggle('tail',!!rec.tailStage);
  $('#phonetic').textContent='';
  updateFavoriteButton();
  updateSlayButton();
  renderChoices(w);
  $('#syllable').textContent=`拆着记：${chunks(w.word)}`;
  const examples=Array.isArray(w.sentences)?w.sentences:(w.sentences?.sentence?[w.sentences]:[]),phrases=Array.isArray(w.phrases)?w.phrases:(w.phrases?.phrase?[w.phrases]:[]),near=nearWords(w,allWords());
  $('#example').innerHTML=examples[0]?.sentence?`${sentenceAudioButton(examples[0].sentence)}${makeInteractiveText(examples[0].sentence,{highlight:[w.word]})}`:'暂无可靠例句。';
  $('#exampleCn').textContent=examples[0]?.translation||'';
  $('#wordKnowledge').innerHTML=`<div class="detail-grid"><section class="detail-section"><h3>高频考点</h3><p class="exam-point">${keyPoint(w)}</p></section><section class="detail-section"><h3>词组搭配</h3>${phrases.length?phrases.slice(0,4).map(p=>`<p><strong>${makeInteractiveText(p.phrase)}</strong>　${p.translation}</p>`).join(''):'<p>暂无搭配数据</p>'}</section><section class="detail-section"><h3>词根提示</h3><p>${rootHint(w.word)}</p></section><section class="detail-section"><h3>近义/相关词</h3>${relatedWordHtml(near)}</section><section class="detail-section"><h3>更多例句</h3>${examples.slice(1,3).map(x=>`<p class="example">${sentenceAudioButton(x.sentence)}${makeInteractiveText(x.sentence,{highlight:[w.word]})}</p><p class="example-cn">${x.translation||''}</p>`).join('')||'<p>暂无更多例句</p>'}</section></div>`;
  void playPronunciation(w.word,'en-US',{preferHuman:false,rate:0.9,pitch:1.08});
}

function finishChoice(correct,selectedIndex=-1){
  if(answered)return;
  const w=current();
  if(!w)return;
  answered=true;
  const reviewOnly=reviewOnlyIndexes.has(index);
  const record=reviewOnly?(getState().records[w.word]||{}):rate(w.word,correct?3:1,w.source);
  if(quizMode&&!reviewOnly){if(correct)quizScore++;quizResults.push({word:w.word,translation:cleanTranslation(w),correct})}
  if(!reviewOnly&&!quizMode&&!correct)queue.splice(Math.min(index+4,queue.length),0,w.word);
  if(!reviewOnly&&!quizMode&&correct&&!reviewMode)setPoolCompleted(w.word,true);
  if(!reviewOnly&&!correct)setPoolCompleted(w.word,false);
  document.querySelectorAll('.choice-option').forEach((button,i)=>{button.disabled=true;if(currentOptions[i]?.word===w.word)button.classList.add('correct');else if(i===selectedIndex)button.classList.add('wrong')});
  $('#phonetic').textContent=`美 /${w.us||'暂无'}/　英 /${w.uk||'暂无'}/`;
  $('#memoryPack').classList.remove('hidden');
  $('#recallCue').classList.add('hidden');
  $('#reveal').classList.add('hidden');
  $('#nextWord').classList.remove('hidden');
  const feedback=$('#choiceFeedback');
  void playPronunciation(w.word,'en-US',{preferHuman:false,rate:0.9,pitch:1.08});
  feedback.textContent=reviewOnly?'这是右滑回看的单词，本次只作回看，不计入连续正确和今日完成。':(quizMode?(correct?`小测答对，已即时朗读。当前得分 ${quizScore}/${quizResults.length}。`:'小测答错，正确次数已清零，并加入错词回炉。'):(correct?(record.correctStreak>=3?'回答正确，已连续正确 3 次，标记为已掌握。':`回答正确，连续正确 ${record.correctStreak}/3。`):'本次未计入今日完成，连续正确已清零，并加入本轮回炉。'));
  feedback.className=`choice-feedback ${correct?'correct':'wrong'}`;
  $('#memoryBadge').textContent=record.tailStage?'已连续正确 3 次':`连续正确 ${record.correctStreak||0}/3`;
  $('#memoryBadge').classList.toggle('tail',!!record.tailStage);
}

function goPreviousWord(){if(index<=0){$('#studyNotice').textContent='已经是本组第一个单词。';$('#studyNotice').classList.remove('hidden');return}index--;reviewOnlyIndexes.add(index);render();$('#studyNotice').textContent='已回到上一个单词：这次回答只用于回看，不计入正确次数。';$('#studyNotice').classList.remove('hidden');const card=$('#card');card.classList.remove('swipe-back');void card.offsetWidth;card.classList.add('swipe-back')}

function openSlayModal(){const w=current();if(!w||quizMode)return;$('#slayWord').textContent=w.word;$('#slayModal').classList.remove('hidden')}
function confirmSlay(){const w=current();if(!w)return;const wasDone=(pool?.completed||[]).includes(w.word)||todayDone(w.word);slayWord(w.word,w.source);if(pool?.items?.includes(w.word)&&!wasDone)setPoolCompleted(w.word,true);const before=queue.slice(0,index),after=queue.slice(index+1).filter(word=>word!==w.word);queue=[...before,...after];reviewOnlyIndexes.clear();$('#slayModal').classList.add('hidden');$('#studyNotice').textContent=`已斩 ${w.word}，不会再进入复习；可在学习记录中恢复。`;$('#studyNotice').classList.remove('hidden');render()}

function buildQueue(){
  pool=getPool();
  if(mode==='due'){reviewMode=true;$('#studyMode').textContent='到期复习';return dueWords()}
  if(mode==='wrong'){reviewMode=true;$('#studyMode').textContent='错词回炉';return shuffle(wrongWords()).slice(0,Math.max(1,Number(params.get('count'))||wrongWords().length))}
  if(mode==='favorite'){reviewMode=true;$('#studyMode').textContent='重点词表';return shuffle(favoriteWords())}
  if(mode==='learned'){reviewMode=true;const view=params.get('view')||'learning';$('#studyMode').textContent=view==='mastered'?'已掌握重温':'学习中重温';return shuffle(learnedWords(view))}
  if(mode==='quiz'){quizMode=true;reviewMode=true;$('#studyMode').textContent='单词小测';document.querySelector('.study-top h1').textContent='专心小测';$('#recallCue').textContent='先读单词，再选择正确中文释义；可点美音/英音听发音';return shuffle(quizCandidates()).slice(0,Math.max(1,Number(params.get('count'))||10))}
  $('#studyMode').textContent='今日背词';
  repairTodayPool();
  return pool.items.filter(x=>!pool.completed.includes(x)&&!todayDone(x));
}

await loadVocabulary();
bindInteractiveEnglish();
await warmSpeechVoices();
queue=buildQueue().filter(word=>findWord(word));
if(!queue.length){
  finishStudy(mode==='today'?'今日任务已完成，可以做小测或加背。':mode==='quiz'?'小测暂无可用单词。先背几个词，再来验收。':'本组暂无可背单词。');
}else{
  render();
}

document.addEventListener('click',e=>{
  const v=e.target.dataset.voice;
  if(v){const w=current();if(w)playPronunciation(w.word,v)}
  const choice=e.target.closest?.('[data-choice]');
  if(choice)finishChoice(currentOptions[Number(choice.dataset.choice)]?.word===current()?.word,Number(choice.dataset.choice));
});
$('#reveal').onclick=()=>finishChoice(false);
$('#nextWord').onclick=()=>{index++;render()};
$('#favoriteToggle').onclick=()=>{const w=current();if(w)setFavorite(w.word,!getState().records[w.word]?.favorite)};
$('#slayToggle').onclick=openSlayModal;
$('#cancelSlay').onclick=()=>$('#slayModal').classList.add('hidden');
$('#confirmSlay').onclick=confirmSlay;
let touchStartX=0,touchStartY=0,touchStartAt=0;
$('#card').addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];if(!t)return;touchStartX=t.clientX;touchStartY=t.clientY;touchStartAt=Date.now()},{passive:true});
$('#card').addEventListener('touchend',e=>{const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-touchStartX,dy=t.clientY-touchStartY,dt=Date.now()-touchStartAt;if(dx>70&&Math.abs(dy)<55&&dt<800)goPreviousWord()},{passive:true});
