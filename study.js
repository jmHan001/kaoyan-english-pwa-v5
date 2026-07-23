import{loadVocabulary,findWord,allWords,getState,saveState}from'./vocabulary-manager.js';
import{getPool}from'./learning-pool.js?v=6.0.0';
import{rate,dueWords,wrongWords,slayWord,migrateMemoryModel}from'./review-manager.js?v=6.1.1';
import{memoryLabel,questionTypeForRecord,memoryStage}from'./memory-engine.js?v=6.1.1';
import{rootHint,keyPoint,nearWords,cleanTranslation,coreTranslation,learningMeaning,matchCoreMeaning}from'./knowledge.js?v=6.1.1';
import{buildChoiceOptions}from'./quiz-options.js?v=6.0.0';
import{todayQuizCandidates}from'./quiz-scope.js?v=6.0.1';
import{bindInteractiveEnglish,makeInteractiveText,sentenceAudioButton}from'./interactive-english.js?v=6.0.0';
import{playPronunciation,warmSpeechVoices}from'./audio-engine.js?v=6.0.0';
import{localDateKey}from'./date-utils.js?v=6.0.0';

const $=selector=>document.querySelector(selector);
const label={gaokao:'高考词',kaoyan:'考研词',both:'高考与考研共有'};
const params=new URLSearchParams(location.search);
const mode=params.get('mode')||'today';
const today=localDateKey;

let pool,queue=[],index=0,currentOptions=[],recentDistractors=[],answered=false,reviewMode=false,quizMode=false,quizScore=0,quizResults=[],quizSaved=false,questionType='acquisition',questionStartedAt=0;
const reviewOnlyIndexes=new Set();
const acquisitionAttempts=new Map();

const shuffle=items=>{const out=[...(items||[])];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out};
function current(){return findWord(queue[index])}
function examplesFor(word){return Array.isArray(word?.sentences)?word.sentences:(word?.sentences?.sentence?[word.sentences]:[])}
function phrasesFor(word){return Array.isArray(word?.phrases)?word.phrases:(word?.phrases?.phrase?[word.phrases]:[])}
function wordsFromList(words){const seen=new Set(),items=[];for(const word of words||[]){const item=typeof word==='string'?findWord(word):word;if(item&&!seen.has(item.word)){seen.add(item.word);items.push(item)}}return items}
function learnedOptionWords(){const state=getState();return wordsFromList(Object.entries(state.records||{}).filter(([,record])=>record?.drawn||record?.lastSeen||record?.level||record?.errors).map(([word])=>word))}
function poolOptionWords(){return wordsFromList(pool?.items||[])}
function reviewOptionWords(){return wordsFromList([...wrongWords(),...dueWords()])}
function makeOptions(word){const options=buildChoiceOptions(word,[learnedOptionWords(),poolOptionWords(),reviewOptionWords()],allWords(),4,Math.random,recentDistractors);recentDistractors=[...options.filter(item=>item?.word!==word.word).map(item=>item.word),...recentDistractors].slice(0,18);return options}
function optionText(value){const text=String(value||'暂无释义').replace(/\s+/g,' ').trim();return text.length>82?`${text.slice(0,82)}…`:text}
function chunks(word){const parts=word.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]*[aeiouy])|[^aeiouy]*$)/gi);return parts?.length>1?parts.join(' · '):word}
function todayDone(word){return getState().records[word]?.todayDoneDate===today()}

function setPoolCompleted(word,done,{recalled=false}={}){
  if(!word)return;
  pool=getPool();
  const completed=new Set(pool.completed||[]);
  if(done)completed.add(word);else completed.delete(word);
  pool.completed=[...completed];
  localStorage.setItem('ky5_pool',JSON.stringify(pool));
  const state=getState(),item=findWord(word),old=state.records[word]||{},next={...old,source:item?.source||old.source};
  if(done){
    next.todayDoneDate=today();
    next.todayExposedDate=today();
    if(recalled)next.todayRecalledDate=today();
    if(old.slain)next.slainCompletedToday=true;
  }else if(next.todayDoneDate===today()){
    delete next.todayDoneDate;
    delete next.todayExposedDate;
    delete next.todayRecalledDate;
  }
  state.records[word]=next;saveState(state);
}

function repairTodayPool(){
  if(!pool?.items?.length)return;
  const completed=new Set(pool.completed||[]);let changed=false;
  for(const word of pool.items)if(todayDone(word)&&!completed.has(word)){completed.add(word);changed=true}
  if(changed){pool.completed=[...completed];localStorage.setItem('ky5_pool',JSON.stringify(pool))}
}

function favoriteWords(){return Object.entries(getState().records||{}).filter(([,record])=>record?.favorite&&!record?.slain).map(([word])=>word)}
function learnedWords(view='all'){
  const state=getState();
  return Object.entries(state.records||{}).filter(([,record])=>{
    const known=record?.drawn||record?.lastSeen||record?.level||record?.errors||record?.favorite,mastered=memoryStage(record)==='mastered';
    return !record?.slain&&known&&(view==='all'||(view==='mastered'?mastered:!mastered));
  }).sort((a,b)=>(Number(b[1].lastSeen)||0)-(Number(a[1].lastSeen)||0)).map(([word])=>word);
}
function quizCandidates(){
  const state=getState();
  return todayQuizCandidates(pool,state.records,today()).filter(word=>findWord(word));
}
function quizBook(){try{return JSON.parse(localStorage.getItem('ky5_quiz')||'{}')}catch{return{}}}
function saveQuizAttempt(){
  if(!quizMode||quizSaved)return;
  const book=quizBook(),wrong=quizResults.filter(result=>!result.correct),day=today();
  book[day]={date:day,attempts:[...(book[day]?.attempts||[]),{id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,at:Date.now(),score:quizScore,total:quizResults.length,wrong:wrong.map(result=>result.word),kinds:quizResults.map(result=>result.kind)}]};
  localStorage.setItem('ky5_quiz',JSON.stringify(book));quizSaved=true;
}

function setFavorite(word,value){
  if(!word)return;
  const state=getState(),item=findWord(word),old=state.records[word]||{};
  state.records[word]={...old,source:item?.source||old.source,drawn:old.drawn||Boolean(item),favorite:Boolean(value),updatedAt:Date.now()};
  saveState(state);updateFavoriteButton();
}
function updateFavoriteButton(){
  const word=current(),button=$('#favoriteToggle');if(!button)return;
  if(!word){button.classList.add('hidden');return}
  const active=Boolean(getState().records[word.word]?.favorite);
  button.classList.remove('hidden');button.classList.toggle('active',active);button.textContent=active?'★':'☆';button.title=active?'取消收藏重点单词':'收藏重点单词';button.setAttribute('aria-pressed',String(active));
}
function updateSlayButton(){const button=$('#slayToggle');if(button)button.classList.toggle('hidden',quizMode||!current())}

function renderChoices(word){
  currentOptions=makeOptions(word);const wrap=$('#choices');wrap.innerHTML='';
  currentOptions.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.className='choice-option';button.dataset.choice=String(i);const key=document.createElement('span');key.className='choice-key';key.textContent=String.fromCharCode(65+i);const text=document.createElement('span');text.textContent=optionText(coreTranslation(item));button.append(key,text);wrap.append(button)});
}

function relatedWordHtml(words){return words.length?`<div class="related-list">${words.map(item=>`<button class="related-word" type="button" data-lookup-word="${item.word}"><strong>${item.word}</strong><small>${cleanTranslation(item)}</small></button>`).join('')}</div>`:'<p>暂无可靠近义关联</p>'}
function renderLearningDetails(word){
  const examples=examplesFor(word),phrases=phrasesFor(word),near=nearWords(word,allWords());
  $('#meaning').textContent=learningMeaning(word);$('#fullMeaning').textContent=cleanTranslation(word);$('#syllable').textContent=`拆着记：${chunks(word.word)}`;
  $('#example').innerHTML=examples[0]?.sentence?`${sentenceAudioButton(examples[0].sentence)}${makeInteractiveText(examples[0].sentence,{highlight:[word.word]})}`:'暂无可靠例句。';
  $('#exampleCn').textContent=examples[0]?.translation||'';
  $('#wordKnowledge').innerHTML=`<div class="detail-grid"><section class="detail-section"><h3>高频考点</h3><p class="exam-point">${keyPoint(word)}</p></section><section class="detail-section"><h3>词组搭配</h3>${phrases.length?phrases.slice(0,4).map(item=>`<p><strong>${makeInteractiveText(item.phrase)}</strong>　${item.translation}</p>`).join(''):'<p>暂无搭配数据</p>'}</section><section class="detail-section"><h3>词根提示</h3><p>${rootHint(word.word)}</p></section><section class="detail-section"><h3>近义/相关词</h3>${relatedWordHtml(near)}</section><section class="detail-section"><h3>更多例句</h3>${examples.slice(1,3).map(item=>`<p class="example">${sentenceAudioButton(item.sentence)}${makeInteractiveText(item.sentence,{highlight:[word.word]})}</p><p class="example-cn">${item.translation||''}</p>`).join('')||'<p>暂无更多例句</p>'}</section></div>`;
}

function resolveQuestionType(word,record){
  const hasContext=Boolean(examplesFor(word)[0]?.sentence),reviewOnly=reviewOnlyIndexes.has(index);
  if(quizMode&&!reviewOnly)return memoryStage(record)==='context'&&hasContext?'context':'recall';
  if(mode==='today'&&!reviewOnly&&(memoryStage(record)==='new'||(record.lastQuestionType==='acquisition'&&record.needsRelearning&&record.todayExposedDate===today())))return'acquisition';
  return questionTypeForRecord(record,{hasContext,reviewOnly});
}

function setAcquisitionPhase(phase,word){
  const meaning=$('#acquisitionMeaning'),instruction=$('#acquisitionInstruction');
  $('#startAcquisition').classList.toggle('hidden',phase!=='learn');
  $('#checkAcquisition').classList.toggle('hidden',phase!=='recall');
  $('#acquisitionPass').classList.toggle('hidden',phase!=='judge');
  $('#acquisitionMiss').classList.toggle('hidden',phase!=='judge');
  meaning.textContent=phase==='recall'?'':learningMeaning(word);
  if(phase==='recall')meaning.setAttribute('aria-label','释义已遮住');else meaning.removeAttribute('aria-label');
  meaning.classList.toggle('concealed',phase==='recall');
  if(phase==='learn'){
    $('#acquisitionStep').textContent='第 1 步 · 只记一个核心义';
    instruction.textContent='听一遍发音，把单词和这一个意思连起来。先不背词根、例句和其他义项。';
  }else if(phase==='recall'){
    $('#acquisitionStep').textContent='第 2 步 · 不看答案口头回忆';
    instruction.textContent='现在用嘴说出中文核心意思。说完以后再检查答案。';
  }else if(phase==='judge'){
    $('#acquisitionStep').textContent='第 3 步 · 如实判断刚才是否想起';
    instruction.textContent='看到答案不算记住，只判断遮住时能不能自己说出来。';
  }
}

function renderQuestion(word,record){
  questionType=resolveQuestionType(word,record);questionStartedAt=Date.now();
  const acquisition=questionType==='acquisition',recall=questionType==='recall',context=questionType==='context',deferChoices=!acquisition&&!recall&&!context&&(record.recognitionCount>0||memoryStage(record)==='relearning');
  $('#acquisitionCard').classList.toggle('hidden',!acquisition);$('#meaningRecall').classList.toggle('hidden',!recall);$('#choices').classList.toggle('hidden',acquisition||recall||deferChoices);$('#contextQuestion').classList.toggle('hidden',!context);$('#showChoices').classList.toggle('hidden',!deferChoices);
  $('#recallAnswer').value='';$('#recallAnswer').disabled=false;$('#submitRecall').disabled=false;
  if(acquisition){currentOptions=[];$('#choices').innerHTML='';$('#recallCue').textContent='先建立连接，再遮住答案自己回忆';setAcquisitionPhase('learn',word)}
  else if(context){const sentence=examplesFor(word)[0]?.sentence||'';$('#contextSentence').innerHTML=makeInteractiveText(sentence,{highlight:[word.word]});$('#recallCue').textContent='语境验证：判断句中这个词的核心含义';renderChoices(word)}
  else if(recall){currentOptions=[];$('#choices').innerHTML='';$('#recallCue').textContent='主动回忆：不看选项，输入一个中文核心意思';}
  else{$('#recallCue').textContent=deferChoices?'先在心里说出一个核心义，再决定是否显示选项':'初次学习：先建立单词与核心义的连接';renderChoices(word)}
  $('#reveal').classList.toggle('hidden',acquisition);
  $('#reveal').textContent=recall?'想不起来，显示答案':'不会，显示答案';
}

function render(){
  const word=current();answered=false;
  $('#memoryPack').classList.add('hidden');$('#acquisitionCard').classList.add('hidden');$('#recallCue').classList.remove('hidden');$('#choiceFeedback').classList.add('hidden');$('#nextWord').classList.add('hidden');$('#reveal').classList.remove('hidden');
  if(!word){if(quizMode){finishQuizStudy();return}finishStudy(reviewMode?'本组复习已完成，已回到主页。':'今日背词已完成，已回到主页。');return}
  $('#card').classList.remove('hidden');$('#word').textContent=word.word;$('#word').dataset.lookupWord=word.word;$('#source').textContent=label[word.source]||'自定义词';$('#phonetic').textContent='';
  const record=getState().records[word.word]||{};$('#memoryBadge').textContent=memoryLabel(record);$('#memoryBadge').classList.toggle('tail',memoryStage(record)==='mastered');
  updateFavoriteButton();updateSlayButton();renderLearningDetails(word);renderQuestion(word,record);
  void playPronunciation(word.word,'en-US',{preferHuman:false,rate:.9,pitch:1.04});
}

function feedbackFor(record,correct,reviewOnly){
  if(reviewOnly)return'这是右滑回看的单词，本次只作回看，不计入学习记录。';
  if(questionType==='acquisition')return correct?'这次遮住答案后能想起，已记为“当天想起”；明天还会无提示验证。':'这次没想起很正常：今天仍算接触过，稍后自动再出现，看到答案本身不计正确。';
  if(!correct)return'这次没有真正想起，已清零本轮连续正确并安排回炉；历史学习记录仍然保留。';
  const stage=memoryStage(record);
  if(questionType==='recognition')return'识别正确：今天算完成，但还不能算长期掌握；后续需要无选项回忆。';
  if(questionType==='context')return stage==='mastered'?'语境验证通过，已达到长期掌握标准。':'语境判断正确，继续等待跨日验证。';
  if(stage==='mastered')return'无提示回忆正确，长期掌握状态继续保持。';
  return`主动回忆正确：${memoryLabel(record)}。不同日期完成两次后再做语境验证。`;
}

function finishAnswer(correct,selectedIndex=-1,meta={}){
  if(answered)return;const word=current();if(!word)return;answered=true;
  const reviewOnly=reviewOnlyIndexes.has(index),record=reviewOnly?(getState().records[word.word]||{}):rate(word.word,{correct,kind:questionType,responseMs:Date.now()-questionStartedAt,revealed:Boolean(meta.revealed)},word.source);
  if(quizMode&&!reviewOnly){if(correct)quizScore++;quizResults.push({word:word.word,translation:cleanTranslation(word),correct,kind:questionType})}
  if(!reviewOnly&&!quizMode&&!correct){
    if(questionType==='acquisition'){
      const attempts=(acquisitionAttempts.get(word.word)||0)+1;acquisitionAttempts.set(word.word,attempts);
      if(attempts<3)queue.splice(Math.min(index+3,queue.length),0,word.word);
    }else queue.splice(Math.min(index+4,queue.length),0,word.word);
  }
  if(!reviewOnly&&mode==='today')setPoolCompleted(word.word,true,{recalled:correct&&questionType!=='recognition'});
  document.querySelectorAll('.choice-option').forEach((button,i)=>{button.disabled=true;if(currentOptions[i]?.word===word.word)button.classList.add('correct');else if(i===selectedIndex)button.classList.add('wrong')});
  $('#recallAnswer').disabled=true;$('#submitRecall').disabled=true;
  $('#phonetic').textContent=`美 /${word.us||'暂无'}/　英 /${word.uk||'暂无'}/`;$('#memoryPack').classList.toggle('hidden',questionType==='acquisition');$('#recallCue').classList.add('hidden');$('#showChoices').classList.add('hidden');$('#reveal').classList.add('hidden');$('#nextWord').classList.remove('hidden');
  if(questionType==='acquisition'){
    $('#acquisitionMeaning').classList.remove('concealed');
    $('#startAcquisition').classList.add('hidden');$('#checkAcquisition').classList.add('hidden');$('#acquisitionPass').classList.add('hidden');$('#acquisitionMiss').classList.add('hidden');
    $('#acquisitionStep').textContent=correct?'本次完成 · 当天想起':'本次完成 · 稍后回炉';
    $('#acquisitionInstruction').textContent=correct?'先继续学习，明天再验证是否真正留下。':(acquisitionAttempts.get(word.word)>=3?'今天已经尝试三次，先放下；稍后在到期复习中再见。':'先继续两个词，稍后会自动再出现。');
    $('#nextWord').textContent=correct?'下一个词':'先继续，稍后再来';
  }else $('#nextWord').textContent='下一个词';
  const feedback=$('#choiceFeedback'),match=meta.match;if(questionType==='recall'&&!correct&&match?.accepted?.length)feedback.textContent=`${feedbackFor(record,false,reviewOnly)} 核心义参考：${learningMeaning(word)}`;else feedback.textContent=feedbackFor(record,correct,reviewOnly);
  feedback.className=`choice-feedback ${correct?'correct':'wrong'}`;$('#memoryBadge').textContent=memoryLabel(record);$('#memoryBadge').classList.toggle('tail',memoryStage(record)==='mastered');
  void playPronunciation(word.word,'en-US',{preferHuman:false,rate:.9,pitch:1.04});
}

function submitMeaningRecall(){
  if(answered||questionType!=='recall')return;const word=current();if(!word)return;
  const input=$('#recallAnswer').value.trim();if(!input){$('#studyNotice').textContent='先输入一个想到的中文核心意思；完全想不起来就点“显示答案”。';$('#studyNotice').classList.remove('hidden');return}
  const match=matchCoreMeaning(input,word);finishAnswer(match.correct,-1,{match});
}

function finishStudy(message){sessionStorage.setItem('ky5_last_study_message',message);location.href='index.html'}
function finishQuizStudy(){saveQuizAttempt();const total=quizResults.length||queue.length,percent=total?Math.round(quizScore/total*100):0,wrong=quizResults.filter(result=>!result.correct).length;finishStudy(`单词小测完成：${quizScore}/${total}，正确率 ${percent}%。${wrong?`错 ${wrong} 个，已进入错词回炉。`:'这组全部通过。'}`)}
function goPreviousWord(){if(index<=0){$('#studyNotice').textContent='已经是本组第一个单词。';$('#studyNotice').classList.remove('hidden');return}index--;reviewOnlyIndexes.add(index);render();$('#studyNotice').textContent='已回到上一个单词：本次只用于回看，不计入任务或掌握状态。';$('#studyNotice').classList.remove('hidden');const card=$('#card');card.classList.remove('swipe-back');void card.offsetWidth;card.classList.add('swipe-back')}
function openSlayModal(){const word=current();if(!word||quizMode)return;$('#slayWord').textContent=word.word;$('#slayModal').classList.remove('hidden')}
function confirmSlay(){const word=current();if(!word)return;const wasDone=(pool?.completed||[]).includes(word.word)||todayDone(word.word);slayWord(word.word,word.source);if(pool?.items?.includes(word.word)&&!wasDone)setPoolCompleted(word.word,true);queue=[...queue.slice(0,index),...queue.slice(index+1).filter(item=>item!==word.word)];reviewOnlyIndexes.clear();$('#slayModal').classList.add('hidden');$('#studyNotice').textContent=`已斩 ${word.word}：已移出学习计划，但未计入“已掌握”。`;$('#studyNotice').classList.remove('hidden');render()}

function buildQueue(){
  pool=getPool();
  if(mode==='due'){reviewMode=true;$('#studyMode').textContent='到期复习';return dueWords()}
  if(mode==='wrong'){reviewMode=true;$('#studyMode').textContent='错词回炉';return shuffle(wrongWords()).slice(0,Math.max(1,Number(params.get('count'))||wrongWords().length))}
  if(mode==='favorite'){reviewMode=true;$('#studyMode').textContent='重点词表';return shuffle(favoriteWords())}
  if(mode==='learned'){reviewMode=true;const view=params.get('view')||'learning';$('#studyMode').textContent=view==='mastered'?'已掌握重温':'学习中重温';return shuffle(learnedWords(view))}
  if(mode==='quiz'){quizMode=true;reviewMode=true;$('#studyMode').textContent='单词小测';document.querySelector('.study-top h1').textContent='主动回忆小测';return shuffle(quizCandidates()).slice(0,Math.max(1,Number(params.get('count'))||10))}
  $('#studyMode').textContent='今日背词';repairTodayPool();return pool.items.filter(word=>!pool.completed.includes(word)&&!todayDone(word));
}

await loadVocabulary();migrateMemoryModel();bindInteractiveEnglish();void warmSpeechVoices();
queue=buildQueue().filter(word=>findWord(word));
if(!queue.length)finishStudy(mode==='today'?'今日任务已完成，可以做小测或加背。':mode==='quiz'?'今日学习池里还没有已背过的单词。先完成几个今日词，再来验收。':'本组暂无可背单词。');else render();

document.addEventListener('click',event=>{
  const voice=event.target.closest?.('[data-voice]')?.dataset.voice;if(voice){const word=current();if(word)void playPronunciation(word.word,voice)}
  const choice=event.target.closest?.('[data-choice]');if(choice)finishAnswer(currentOptions[Number(choice.dataset.choice)]?.word===current()?.word,Number(choice.dataset.choice));
});
$('#meaningRecall').addEventListener('submit',event=>{event.preventDefault();submitMeaningRecall()});
$('#startAcquisition').onclick=()=>{const word=current();if(!word||questionType!=='acquisition'||answered)return;setAcquisitionPhase('recall',word);void playPronunciation(word.word,'en-US',{preferHuman:false,rate:.9,pitch:1.04})};
$('#checkAcquisition').onclick=()=>{const word=current();if(!word||questionType!=='acquisition'||answered)return;setAcquisitionPhase('judge',word)};
$('#acquisitionPass').onclick=()=>finishAnswer(true,-1,{selfChecked:true});
$('#acquisitionMiss').onclick=()=>finishAnswer(false,-1,{selfChecked:true});
$('#showChoices').onclick=()=>{$('#choices').classList.remove('hidden');$('#showChoices').classList.add('hidden');$('#recallCue').textContent='现在再用选项确认；本题只记录为识别通过。'};
$('#reveal').onclick=()=>{const word=current(),match=word?matchCoreMeaning('',word):null;finishAnswer(false,-1,{revealed:true,match})};
$('#nextWord').onclick=()=>{index++;render()};
$('#favoriteToggle').onclick=()=>{const word=current();if(word)setFavorite(word.word,!getState().records[word.word]?.favorite)};
$('#slayToggle').onclick=openSlayModal;$('#cancelSlay').onclick=()=>$('#slayModal').classList.add('hidden');$('#confirmSlay').onclick=confirmSlay;
let touchStartX=0,touchStartY=0,touchStartAt=0;
$('#card').addEventListener('touchstart',event=>{const touch=event.changedTouches?.[0];if(!touch)return;touchStartX=touch.clientX;touchStartY=touch.clientY;touchStartAt=Date.now()},{passive:true});
$('#card').addEventListener('touchend',event=>{const touch=event.changedTouches?.[0];if(!touch)return;const dx=touch.clientX-touchStartX,dy=touch.clientY-touchStartY,dt=Date.now()-touchStartAt;if(dx>70&&Math.abs(dy)<55&&dt<800)goPreviousWord()},{passive:true});
