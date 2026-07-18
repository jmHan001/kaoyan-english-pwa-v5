import{loadVocabulary,findWord,allWords,getSettings,saveSettings,getState,saveState,migrateLegacy,exportAll}from'./vocabulary-manager.js';
import{getPool,remove,replace,toggleLock,add,fill,resize,extend}from'./learning-pool.js?v=5.8.2';
import{rate,dueWords,wrongWords,restoreSlainWord}from'./review-manager.js?v=5.8.0';
import{stats}from'./stats.js?v=5.8.0';
import{rootHint,keyPoint,nearWords,cleanTranslation,coreTranslation}from'./knowledge.js?v=5.6.25';
import{getSyncConfig,isConfigured,startAutoSync}from'./cloud-sync.js?v=5.8.2';
import{buildChoiceOptions}from'./quiz-options.js?v=5.7.3';
import{bindInteractiveEnglish,makeInteractiveText,sentenceAudioButton}from'./interactive-english.js?v=5.6.17';
import{playPronunciation}from'./audio-engine.js?v=5.6.17';
import{localDateKey}from'./date-utils.js?v=5.8.0';

let pool,index=0,queue=[],reviewMode=false,currentOptions=[],answered=false,quiz=null,quizOptions=[],recentDistractors=[],studyOpen=false,learnedView='learning';
const reviewOnlyIndexes=new Set();
const $=s=>document.querySelector(s),label={gaokao:'高考词',kaoyan:'考研词',both:'高考与考研共有'};
const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const formatTime=value=>value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未同步';
const today=localDateKey;

function shuffle(a){a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function wordsFromList(words){const seen=new Set(),items=[];for(const word of words||[]){const item=typeof word==='string'?findWord(word):word;if(item&&!seen.has(item.word)){seen.add(item.word);items.push(item)}}return items}
function learnedOptionWords(){const state=getState();return wordsFromList(Object.entries(state.records||{}).filter(([,record])=>record?.drawn||record?.lastSeen||record?.level||record?.errors).map(([word])=>word))}
function poolOptionWords(){const p=pool||getPool();return wordsFromList(p?.items||[])}
function reviewOptionWords(){return wordsFromList([...wrongWords(),...dueWords()])}
function makeOptions(word){const options=buildChoiceOptions(word,[learnedOptionWords(),poolOptionWords(),reviewOptionWords()],allWords(),4,Math.random,recentDistractors);recentDistractors=[...options.filter(item=>item?.word!==word.word).map(item=>item.word),...recentDistractors].slice(0,12);return options}
function optionText(value){const text=String(value||'暂无释义').replace(/\s+/g,' ').trim();return text.length>82?`${text.slice(0,82)}…`:text}
function todayDone(word){return getState().records[word]?.todayDoneDate===today()}
function renderChoices(word){currentOptions=makeOptions(word);const wrap=$('#choices');wrap.innerHTML='';currentOptions.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.className='choice-option';button.dataset.choice=String(i);const key=document.createElement('span');key.className='choice-key';key.textContent=String.fromCharCode(65+i);const text=document.createElement('span');text.textContent=optionText(coreTranslation(item));button.append(key,text);wrap.append(button)})}
function setPoolCompleted(word,done){if(!word)return;pool=getPool();const completed=new Set(pool.completed||[]);if(done)completed.add(word);else completed.delete(word);pool.completed=[...completed];localStorage.setItem('ky5_pool',JSON.stringify(pool));const state=getState(),item=findWord(word),old=state.records[word]||{},next={...old,source:item?.source||old.source};if(done)next.todayDoneDate=today();else if(next.todayDoneDate===today())delete next.todayDoneDate;state.records[word]=next;saveState(state);const task=renderTaskProgress();renderAcceptance(task);return task}
function favoriteWords(){const state=getState();return Object.entries(state.records||{}).filter(([,record])=>record?.favorite&&!record?.slain).map(([word])=>word)}
function learnedWords(view='all'){const state=getState();return Object.entries(state.records||{}).filter(([,record])=>{const known=record?.drawn||record?.lastSeen||record?.level||record?.errors||record?.favorite,mastered=record?.tailStage||record?.level>=4;return known&&(view==='all'||(view==='mastered'?mastered:!mastered))}).sort((a,b)=>(b[1].lastSeen||0)-(a[1].lastSeen||0)).map(([word])=>word)}
function setFavorite(word,value){if(!word)return;const state=getState(),item=findWord(word),old=state.records[word]||{};state.records[word]={...old,source:item?.source||old.source,drawn:old.drawn||!!item,favorite:!!value};saveState(state);updateFavoriteButton();renderFavoriteList()}
function updateFavoriteButton(){const w=current(),button=$('#favoriteToggle');if(!button)return;if(!w){button.classList.add('hidden');return}const active=!!getState().records[w.word]?.favorite;button.classList.remove('hidden');button.classList.toggle('active',active);button.textContent=active?'★':'☆';button.title=active?'取消收藏重点单词':'收藏重点单词';button.setAttribute('aria-pressed',String(active))}
function renderFavoriteList(){const wrap=$('#favoriteList');if(!wrap)return;const words=favoriteWords();$('#favoriteMeta').textContent=`已收藏 ${words.length} 个重点词`;wrap.innerHTML=words.length?words.map(word=>{const item=findWord(word),record=getState().records[word]||{};return`<div class="row"><div><strong>${word}</strong><small>${item?cleanTranslation(item):'当前词库未收录'} · 连续正确 ${record.correctStreak||0}/3</small></div><div class="row-actions"><button class="iconbtn" data-speak-word="${word}" title="播放发音">▶</button><button class="iconbtn" data-unfavorite="${word}" title="取消收藏">★</button></div></div>`}).join(''):'<div class="empty">还没有收藏。背词时点右上角星标加入重点词表。</div>'}
function openFavoriteModal(){renderFavoriteList();$('#favoriteModal').classList.remove('hidden')}
function renderWrongList(){const wrap=$('#wrongList');if(!wrap)return;const words=wrongWords(),state=getState();$('#wrongMeta').textContent=`全部错词 ${words.length} 个`;document.querySelectorAll('[data-wrong-count]').forEach(button=>button.disabled=!words.length);wrap.innerHTML=words.length?words.slice(0,80).map(word=>{const item=findWord(word),record=state.records[word]||{};return`<div class="row"><div><strong>${word}</strong><small>${item?cleanTranslation(item):'当前词库未收录'} · 错 ${record.errors||0} 次 · 连续正确 ${record.correctStreak||0}/3</small></div><div class="row-actions"><button class="iconbtn" data-speak-word="${word}" title="播放发音" aria-label="播放 ${word} 的发音">▶</button></div></div>`}).join(''):'<div class="empty">还没有错词。答错后的词会自动进入这里。</div>'}
function openWrongModal(){renderWrongList();$('#wrongModal').classList.remove('hidden')}
function openStudyWindow(title='背单词'){studyOpen=true;$('#studyTitle').textContent=title;$('#studyWindow').classList.remove('hidden');$('#done').classList.add('hidden');$('#afterTask').classList.add('hidden')}
function closeStudyWindow(message='已回到主页。'){studyOpen=false;$('#studyWindow').classList.add('hidden');$('#card').classList.add('hidden');$('#done').classList.add('hidden');$('#afterTask').classList.add('hidden');updateFavoriteButton();const task=renderTaskProgress();renderAcceptance(task);$('#reviewNotice').textContent=message;$('#reviewNotice').classList.remove('hidden')}
function startWordReview(words,message,title='背单词'){queue=words.filter(word=>findWord(word));if(!queue.length){$('#reviewNotice').textContent=message||'没有可重温的单词。';$('#reviewNotice').classList.remove('hidden');return false}reviewMode=true;index=0;openStudyWindow(title);$('#reviewNotice').textContent=message||`本次打开 ${queue.length} 个单词。`;$('#reviewNotice').classList.remove('hidden');render();return true}
function startWrongReview(count){const words=wrongWords();$('#wrongModal').classList.add('hidden');if(!words.length){$('#reviewNotice').textContent='暂无错词。答错后的词会自动进入错词回炉。';$('#reviewNotice').classList.remove('hidden');return}location.href=`study.html?mode=wrong&count=${encodeURIComponent(count==='all'?words.length:count||10)}`}
function startFavoriteReview(){const words=favoriteWords();$('#favoriteModal').classList.add('hidden');if(!words.length){$('#reviewNotice').textContent='重点词表为空。背词时点右上角星标加入。';$('#reviewNotice').classList.remove('hidden');return}location.href='study.html?mode=favorite'}
function renderLearnedList(){const wrap=$('#learnedList');if(!wrap)return;const words=learnedWords(learnedView),state=getState(),learning=learnedWords('learning').length,mastered=learnedWords('mastered').length;$('#learnedMeta').textContent=`学习中 ${learning} · 已掌握 ${mastered}`;document.querySelectorAll('[data-learned-view]').forEach(button=>{const active=button.dataset.learnedView===learnedView;button.classList.toggle('active',active);button.classList.toggle('secondary',!active)});wrap.innerHTML=words.length?words.slice(0,160).map(word=>{const item=findWord(word),record=state.records[word]||{};const status=record.slain?'已斩 · 不再复习':record.tailStage||record.level>=4?'已掌握':record.errors?'学习中 · 曾答错':'学习中';return`<div class="row"><div><strong>${word}</strong><small>${item?coreTranslation(item):'当前词库未收录'} · ${status} · 连续正确 ${record.correctStreak||0}/3</small></div><div class="row-actions"><button class="iconbtn" data-speak-word="${word}" title="播放发音">▶</button>${record.slain?`<button class="iconbtn" data-restore-slain="${encodeURIComponent(word)}" title="恢复斩词" aria-label="恢复 ${word}">复</button>`:`<button class="iconbtn" data-toggle-favorite="${word}" title="收藏重点">${record.favorite?'★':'☆'}</button>`}</div></div>`}).join(''):`<div class="empty">${learnedView==='mastered'?'还没有达到连续正确 3 次的单词。':'当前没有学习中的单词。'}</div>`}
function openLearnedModal(){renderLearnedList();$('#learnedModal').classList.remove('hidden')}
function startLearnedReview(){const state=getState(),words=learnedWords(learnedView).filter(word=>!state.records[word]?.slain);$('#learnedModal').classList.add('hidden');if(!words.length){$('#reviewNotice').textContent='当前列表没有可重温的单词；已斩词需要先恢复。';$('#reviewNotice').classList.remove('hidden');return}location.href=`study.html?mode=learned&view=${learnedView}`}
function restoreSlain(word){const before=getState().records[word]||{},record=restoreSlainWord(word);if(before.slainCompletedToday){pool=getPool();pool.completed=(pool.completed||[]).filter(item=>item!==word);localStorage.setItem('ky5_pool',JSON.stringify(pool));renderTaskProgress()}renderLearnedList();renderStats();$('#reviewNotice').textContent=`已恢复 ${word}，原来的学习记录和复习状态已经还原。`;$('#reviewNotice').classList.remove('hidden');return record}
function goPreviousWord(){if(index<=0){$('#reviewNotice').textContent='已经是本组第一个单词。';$('#reviewNotice').classList.remove('hidden');return}index--;reviewOnlyIndexes.add(index);render();$('#reviewNotice').textContent='已回到上一个单词：这次回答只用于回看，不计入正确次数。';$('#reviewNotice').classList.remove('hidden');const card=$('#card');card.classList.remove('swipe-back');void card.offsetWidth;card.classList.add('swipe-back')}

function renderStats(){const x=stats();
$('#stats').innerHTML=`<div class="stat"><strong>${x.gaokao.rate}%</strong><span>高考掌握率 · ${x.gaokao.mastered}/${x.gaokao.total}</span></div><div class="stat"><strong>${x.kaoyan.rate}%</strong><span>考研掌握率 · ${x.kaoyan.mastered}/${x.kaoyan.total}</span></div><div class="stat"><strong>${x.due}</strong><span>到期复习</span></div><div class="stat"><strong>${x.streak} 天</strong><span>连续学习</span></div>`;
if($('#homeStreak'))$('#homeStreak').textContent=`连续 ${x.streak||0} 天`;
if($('#homeDueCount'))$('#homeDueCount').textContent=String(x.due||0);
if($('#homeWrongCount'))$('#homeWrongCount').textContent=String(wrongWords().length||0)}
function repairTodayPool(){if(!pool?.items?.length)return;const completed=new Set(pool.completed||[]);let changed=false;for(const word of pool.items){if(todayDone(word)&&!completed.has(word)){completed.add(word);changed=true}}if(changed){pool.completed=[...completed];localStorage.setItem('ky5_pool',JSON.stringify(pool))}}
function renderTaskProgress(){if(!pool)return{total:0,done:0};repairTodayPool();const total=pool.items.length,completed=new Set(pool.completed||[]),done=pool.items.filter(word=>completed.has(word)||todayDone(word)).length,remaining=Math.max(0,total-done),progress=$('#todayProgress');$('#todayCount').textContent=`${done}/${total}`;$('#todayRemaining').textContent=total?(remaining?`还剩 ${remaining} 个单词需要答对`:'今日任务已全部答对'):'学习池为空，请在编辑学习池中添加单词';progress.max=Math.max(1,total);progress.value=done;$('#todayTask').classList.toggle('complete',total>0&&done===total);return{total,done}}
function renderSyncStatus(status='idle',error=null){const el=$('#syncStatus');if(!el)return;const configured=isConfigured(getSyncConfig()),meta=readJson('ky5_sync_meta',{});el.className=`sync-pill ${configured?'configured':'missing'} ${status}`;if(status==='busy')el.textContent='正在同步';else if(status==='error')el.textContent=`同步异常 · ${String(error?.message||error||'点此处理').slice(0,22)}`;else el.textContent=configured?`已同步 · ${formatTime(meta.lastSyncAt||meta.lastAppliedAt)}`:'未绑定同步';}
function quizBook(){return readJson('ky5_quiz',{})}
function saveQuizAttempt(){const day=today(),book=quizBook(),wrong=quiz.results.filter(x=>!x.correct);book[day]={date:day,attempts:[...(book[day]?.attempts||[]),{id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,at:Date.now(),score:quiz.score,total:quiz.items.length,wrong:wrong.map(x=>x.word)}]};localStorage.setItem('ky5_quiz',JSON.stringify(book))}
function acceptance(task=renderTaskProgress()){const attempts=quizBook()[today()]?.attempts||[],best=attempts.reduce((best,x)=>!best||x.score/x.total>best.score/best.total?x:best,null),needQuiz=Math.min(10,Math.max(1,task.total||0)),taskOk=task.total>0&&task.done>=task.total,quizDone=best&&best.total>=needQuiz,quizRate=best?Math.round(best.score/best.total*100):0,quizOk=quizDone&&quizRate>=80;let status='待完成',tone='pending',advice='先完成今日学习池，再做一次单词小测。';if(taskOk&&!quizDone){status='待小测';advice=`今日新词已完成，还需要做 ${needQuiz} 题左右的小测。`}if(taskOk&&quizDone&&!quizOk){status='需加练';tone='warn';advice=`小测正确率 ${quizRate}%，低于 80%。先复习错词，再测一组。`}if(taskOk&&quizOk){status='合格';tone='pass';advice=`小测 ${best.score}/${best.total}，今天算真的背到了。`}return{status,tone,advice,taskOk,quizDone,quizOk,quizRate,best,attempts,needQuiz}}
function renderAcceptance(task=renderTaskProgress()){const a=acceptance(task),panel=$('#acceptancePanel');if(!panel)return;panel.className=`acceptance-panel ${a.tone}`;panel.innerHTML=`<div><span class="section-kicker">今日验收</span><strong>${a.status}</strong><p>${a.advice}</p></div><div class="acceptance-checks"><span class="${a.taskOk?'ok':'wait'}">学习池 ${task.done}/${task.total}</span><span class="${a.quizDone?'ok':'wait'}">小测 ${a.best?`${a.best.score}/${a.best.total}`:'未测'}</span><span class="${a.quizOk?'ok':'wait'}">正确率 ${a.best?`${a.quizRate}%`:'--'}</span></div><button class="btn secondary" data-home-action="${a.taskOk?'quiz':'today'}">${a.taskOk?(a.quizOk?'再测一组':'开始验收'):'继续今日背词'}</button>`}
function actionCard(kind,title,value,copy,action){return`<button class="next-card ${kind}" data-home-action="${action}"><strong>${value}</strong><span>${title}</span><small>${copy}</small></button>`}
function relatedWordHtml(words){return words.length?`<div class="related-list">${words.map(x=>`<button class="related-word" type="button" data-lookup-word="${x.word}"><strong>${x.word}</strong><small>${cleanTranslation(x)}</small></button>`).join('')}</div>`:'<p>暂无可靠近义关联</p>'}
function startTodayWords(){location.href='study.html?mode=today'}
function renderAfterTask(task){if(!pool)return;const wrap=$('#afterTask');const due=dueWords(),wrong=wrongWords(),completed=new Set(pool.completed||[]);const learned=pool.items.map(word=>{const w=findWord(word),done=completed.has(word)||todayDone(word);return`<span class="word-chip ${done?'done':'open'}">${word}<small>${done?'已完成':'未完成'}</small>${w?.source?`<em>${label[w.source]||'自定义'}</em>`:''}</span>`}).join('');wrap.innerHTML=`<div class="after-head"><div><span class="section-kicker">今天收尾</span><h2>${task.done}/${task.total} 已完成</h2><p>新词任务已经闭环。想多背就在上方“今日任务”里加背或重开今日背词，不再把主入口藏到下面。</p></div><button class="btn secondary" data-home-action="pool">查看学习池</button></div><div class="extra-study"><span>今天状态不错，继续加背</span><div><button class="btn secondary" data-extra="5">+5 词</button><button class="btn secondary" data-extra="10">+10 词</button><button class="btn secondary" data-extra="20">+20 词</button></div></div><div class="next-grid">${actionCard('quiz','单词小测',Math.min(10,pool.items.length),'抽今日学习池检查一下','quiz')}${actionCard('review','到期复习',due.length,'先处理今天该回来的词','review')}${actionCard('wrong','错词回炉',wrong.length,'把连续错的词再过一遍','wrong')}<a class="next-card reading" href="reading.html"><strong>阅读</strong><span>阅读理解</span><small>用文章检查单词是否真的会用</small></a><a class="next-card lookup" href="lookup.html"><strong>查</strong><span>查词补漏</span><small>不会的词手动加入学习池</small></a></div><section class="learned-panel"><div class="learned-head"><h3>今日学习池</h3><small>${pool.date||'今天'} · 固定 ${pool.items.length} 词</small></div><div class="word-chip-list">${learned||'<span class="empty">学习池为空</span>'}</div></section>`;wrap.classList.remove('hidden')}
function chunks(word){const parts=word.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]*[aeiouy])|[^aeiouy]*$)/gi);return parts?.length>1?parts.join(' · '):word}function current(){return findWord(queue[index])}function render(){if(!$('#card')){$('#afterTask')?.classList.add('hidden');renderAcceptance(renderTaskProgress());return}if(!studyOpen){$('#card').classList.add('hidden');$('#afterTask').classList.add('hidden');updateFavoriteButton();renderAcceptance(renderTaskProgress());return}const w=current();
answered=false;
$('#memoryPack').classList.add('hidden');
$('#recallCue').classList.remove('hidden');
$('#choiceFeedback').classList.add('hidden');
$('#nextWord').classList.add('hidden');
$('#reveal').classList.remove('hidden');
if(!w){$('#card').classList.add('hidden');
updateFavoriteButton();
const task=renderTaskProgress();
renderAcceptance(task);
closeStudyWindow(!reviewMode&&task.total>0&&task.done===task.total?`今日任务已完成：${task.done}/${task.total}，已回到主页。`:'本组背词已完成，已回到主页。');
return}$('#card').classList.remove('hidden');
$('#afterTask').classList.add('hidden');
$('#done').classList.add('hidden');
$('#word').textContent=w.word;
$('#word').dataset.lookupWord=w.word;
$('#meaning').textContent=coreTranslation(w);
$('#source').textContent=label[w.source]||'自定义词';
const rec=getState().records[w.word]||{};
$('#memoryBadge').textContent=rec.tailStage?'长时记忆尾期':`连续正确 ${rec.correctStreak||0}/3`;
$('#memoryBadge').classList.toggle('tail',!!rec.tailStage);
$('#phonetic').textContent='';
updateFavoriteButton();
renderChoices(w);
$('#syllable').textContent=`拆着记：${chunks(w.word)}`;
const examples=Array.isArray(w.sentences)?w.sentences:(w.sentences?.sentence?[w.sentences]:[]),phrases=Array.isArray(w.phrases)?w.phrases:(w.phrases?.phrase?[w.phrases]:[]),near=nearWords(w,allWords());
$('#example').innerHTML=examples[0]?.sentence?`${sentenceAudioButton(examples[0].sentence)}${makeInteractiveText(examples[0].sentence,{highlight:[w.word]})}`:'暂无可靠例句。';
$('#exampleCn').textContent=examples[0]?.translation||'';
$('#wordKnowledge').innerHTML=`<div class="detail-grid"><section class="detail-section"><h3>高频考点</h3><p class="exam-point">${keyPoint(w)}</p></section><section class="detail-section"><h3>词组搭配</h3>${phrases.length?phrases.slice(0,4).map(p=>`<p><strong>${makeInteractiveText(p.phrase)}</strong>　${p.translation}</p>`).join(''):'<p>暂无搭配数据</p>'}</section><section class="detail-section"><h3>词根提示</h3><p>${rootHint(w.word)}</p></section><section class="detail-section"><h3>近义/相关词</h3>${relatedWordHtml(near)}</section><section class="detail-section"><h3>更多例句</h3>${examples.slice(1,3).map(x=>`<p class="example">${sentenceAudioButton(x.sentence)}${makeInteractiveText(x.sentence,{highlight:[w.word]})}</p><p class="example-cn">${x.translation||''}</p>`).join('')||'<p>暂无更多例句</p>'}</section></div>`}
function renderPool(){pool=getPool();
renderAcceptance(renderTaskProgress());
$('#poolList').innerHTML=pool.items.map(w=>{const x=findWord(w);
return`<div class="row"><div><strong>${w}</strong><small>${x?cleanTranslation(x):''}</small></div><div class="row-actions"><button class="iconbtn" data-speak-word="${w}" title="播放发音">▶</button><button class="iconbtn" data-lock="${w}" title="锁定">${pool.locked?.includes(w)?'锁':'固'}</button><button class="iconbtn" data-replace="${w}" title="替换">换</button><button class="iconbtn" data-remove="${w}" title="删除">删</button></div></div>`}).join('')||'<div class="empty">学习池为空</div>'}
function startReview(type='due'){const words=type==='wrong'?wrongWords():dueWords();if(!words.length){$('#reviewNotice').textContent=type==='wrong'?'暂无错词。今天可以去阅读或查词补漏。':'暂无到期复习。先完成几个新词，完全不会的词会在本轮 3 个词后再次出现。';$('#reviewNotice').classList.remove('hidden');return}location.href=`study.html?mode=${type==='wrong'?'wrong':'due'}`}
function addExtraWords(count){const added=extend(count);pool=getPool();if(!added.length){$('#reviewNotice').textContent='当前词库没有可追加的新词了，可以先做复习或查词。';$('#reviewNotice').classList.remove('hidden');return}location.href='study.html?mode=today'}
function quizCandidates(){pool=getPool();const state=getState(),seen=new Set(),items=[];for(const word of pool.items){const w=findWord(word);if(w&&!state.records[w.word]?.slain&&!seen.has(w.word)){seen.add(w.word);items.push(w)}}for(const word of [...wrongWords(),...dueWords()]){const w=findWord(word);if(w&&!state.records[w.word]?.slain&&!seen.has(w.word)){seen.add(w.word);items.push(w)}}return items}
function startQuiz(){const items=quizCandidates();if(!items.length){$('#reviewNotice').textContent='今日学习池还没有可测试的单词。先背几个词，再来小测。';$('#reviewNotice').classList.remove('hidden');return}location.href='study.html?mode=quiz&count=10'}
function renderQuiz(){const body=$('#quizBody');if(!quiz)return;if(quiz.index>=quiz.items.length){if(!quiz.saved){saveQuizAttempt();quiz.saved=true}const wrong=quiz.results.filter(x=>!x.correct),a=acceptance();body.innerHTML=`<div class="quiz-result"><strong>${quiz.score}/${quiz.items.length}</strong><span>${a.quizOk?'验收合格':'小测完成'}</span><p>${a.quizOk?'这组能过，今天算背到。':wrong.length?`错了 ${wrong.length} 个，已自动加入回炉。正确率要到 80% 才算通过。`:'题量还不够，建议再测一组。'}</p>${wrong.length?`<div class="word-chip-list">${wrong.map(x=>`<span class="word-chip open">${x.word}<small>${x.translation||''}</small></span>`).join('')}</div>`:''}<div class="toolbar quiz-actions"><button class="btn secondary" data-quiz-action="retry">再测一组</button><button class="btn secondary" data-quiz-action="review">复习错词</button><button class="btn" data-quiz-action="close">完成</button></div></div>`;renderStats();renderAcceptance();return}const w=quiz.items[quiz.index];quiz.locked=false;quizOptions=makeOptions(w);body.innerHTML=`<div class="quiz-progress"><span>第 ${quiz.index+1} / ${quiz.items.length} 题</span><strong>${quiz.score} 分</strong></div><div class="quiz-word"><small>选择正确中文释义</small><h3>${w.word}</h3><p class="phonetic">${label[w.source]||'自定义词'}</p></div><div class="choice-grid quiz-choice-grid" id="quizChoices"></div><div class="choice-feedback hidden" id="quizFeedback" aria-live="polite"></div>`;const wrap=$('#quizChoices');quizOptions.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.className='choice-option';button.dataset.quizChoice=String(i);const key=document.createElement('span');key.className='choice-key';key.textContent=String.fromCharCode(65+i);const text=document.createElement('span');text.textContent=optionText(cleanTranslation(item));button.append(key,text);wrap.append(button)})}
function finishQuizChoice(selectedIndex){if(!quiz||quiz.locked)return;const w=quiz.items[quiz.index],chosen=quizOptions[selectedIndex],correct=chosen?.word===w.word;quiz.locked=true;if(correct)quiz.score++;const record=rate(w.word,correct?3:1,w.source);if(!correct)setPoolCompleted(w.word,false);quiz.results.push({word:w.word,translation:w.translation,correct});document.querySelectorAll('[data-quiz-choice]').forEach((button,i)=>{button.disabled=true;if(quizOptions[i]?.word===w.word)button.classList.add('correct');else if(i===selectedIndex)button.classList.add('wrong')});const feedback=$('#quizFeedback');feedback.textContent=correct?(record.correctStreak>=3?'答对，已进入已掌握。':`答对，连续正确 ${record.correctStreak}/3。`):'答错，正确次数已清零，并加入错词回炉。';feedback.className=`choice-feedback ${correct?'correct':'wrong'}`;feedback.insertAdjacentHTML('afterend','<div class="toolbar quiz-next"><button class="btn" data-quiz-next="1">下一题</button></div>');renderStats()}
function speak(lang){const w=current();if(w)playPronunciation(w.word,lang)}
function finishChoice(correct,selectedIndex=-1){if(answered)return;const w=current();if(!w)return;answered=true;const reviewOnly=reviewOnlyIndexes.has(index);const record=reviewOnly?(getState().records[w.word]||{}):rate(w.word,correct?3:1,w.source);if(!reviewOnly&&!correct)queue.splice(Math.min(index+4,queue.length),0,w.word);if(!reviewOnly&&correct&&!reviewMode)setPoolCompleted(w.word,true);if(!reviewOnly&&!correct)setPoolCompleted(w.word,false);const buttons=[...document.querySelectorAll('.choice-option')];buttons.forEach((button,i)=>{button.disabled=true;if(currentOptions[i]?.word===w.word)button.classList.add('correct');else if(i===selectedIndex)button.classList.add('wrong')});$('#phonetic').textContent=`美 /${w.us||'暂无'}/　英 /${w.uk||'暂无'}/`;$('#memoryPack').classList.remove('hidden');$('#recallCue').classList.add('hidden');$('#reveal').classList.add('hidden');$('#nextWord').classList.remove('hidden');const feedback=$('#choiceFeedback');if(correct)void playPronunciation(w.word,'en-US');feedback.textContent=reviewOnly?'这是右滑回看的单词，本次只作回看，不计入连续正确和今日完成。':(correct?(record.correctStreak>=3?'回答正确，已连续正确 3 次，标记为已掌握。':`回答正确，连续正确 ${record.correctStreak}/3。`):'本次未计入今日完成，连续正确已清零，并加入本轮回炉。');feedback.className=`choice-feedback ${correct?'correct':'wrong'}`;$('#memoryBadge').textContent=record.tailStage?'已连续正确 3 次':`连续正确 ${record.correctStreak||0}/3`;$('#memoryBadge').classList.toggle('tail',!!record.tailStage);renderStats()}
async function init(){await loadVocabulary();
bindInteractiveEnglish();
const mig=migrateLegacy();
const s=getSettings();
$('#mode').value=s.mode;
ensureDailyOption(s.daily);
pool=getPool();
repairTodayPool();
queue=pool.items.filter(x=>!pool.completed.includes(x)&&!todayDone(x));
renderStats();
renderAcceptance(renderTaskProgress());
renderSyncStatus();
render();
const lastStudyMessage=sessionStorage.getItem('ky5_last_study_message');
if(lastStudyMessage){sessionStorage.removeItem('ky5_last_study_message');$('#reviewNotice').textContent=lastStudyMessage;$('#reviewNotice').classList.remove('hidden')}
if(!mig.done)$('#done').innerHTML=`旧数据迁移失败。<button class="btn" id="backupOld">导出旧数据</button>`;
if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.register('./sw.js');
reg.addEventListener('updatefound',()=>{const worker=reg.installing;
worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){document.body.insertAdjacentHTML('beforeend','<div class="update">发现新版本 <button class="btn accent" onclick="location.reload()">点击更新</button></div>')}})})}}
if($('#reveal'))$('#reveal').onclick=()=>finishChoice(false);
if($('#nextWord'))$('#nextWord').onclick=()=>{index++;render()};
document.addEventListener('click',e=>{const v=e.target.dataset.voice;
if(v)speak(v);
const speakWord=e.target.closest?.('[data-speak-word]')?.dataset.speakWord;
if(speakWord)playPronunciation(speakWord,'en-US');
const action=e.target.closest?.('[data-home-action]')?.dataset.homeAction;
if(action==='review')startReview('due');
if(action==='today')startTodayWords();
if(action==='wrong')openWrongModal();
if(action==='pool'){$('#poolBtn').click()}
if(action==='quiz')startQuiz();
const extra=e.target.closest?.('[data-extra]')?.dataset.extra;
if(extra)addExtraWords(Number(extra));
const quizChoice=e.target.closest?.('[data-quiz-choice]')?.dataset.quizChoice;
if(quizChoice)finishQuizChoice(Number(quizChoice));
if(e.target.closest?.('[data-quiz-next]')){quiz.index++;renderQuiz()}
const quizAction=e.target.closest?.('[data-quiz-action]')?.dataset.quizAction;
if(quizAction==='close'){$('#quizModal').classList.add('hidden');quiz=null}
if(quizAction==='retry')startQuiz();
if(quizAction==='review'){$('#quizModal').classList.add('hidden');openWrongModal()}
const choice=e.target.closest?.('[data-choice]');if(choice)finishChoice(currentOptions[Number(choice.dataset.choice)]?.word===current()?.word,Number(choice.dataset.choice));
if(e.target.dataset.remove){remove(e.target.dataset.remove);
renderPool()}if(e.target.dataset.replace){replace(e.target.dataset.replace);
renderPool()}if(e.target.dataset.lock){toggleLock(e.target.dataset.lock);
renderPool()}if(e.target.dataset.unfavorite){setFavorite(e.target.dataset.unfavorite,false)}if(e.target.dataset.toggleFavorite){setFavorite(e.target.dataset.toggleFavorite,!getState().records[e.target.dataset.toggleFavorite]?.favorite);renderLearnedList()}if(e.target.dataset.restoreSlain){restoreSlain(decodeURIComponent(e.target.dataset.restoreSlain))}if(e.target.dataset.learnedView){learnedView=e.target.dataset.learnedView;renderLearnedList()}});
function ensureDailyOption(value){const select=$('#daily'),text=String(value);if(![...select.options].some(o=>o.value===text||o.textContent===text)){const option=document.createElement('option');option.value=text;option.textContent=text;select.insertBefore(option,select.querySelector('[value="custom"]'))}select.value=text}
function applyDaily(daily){daily=Math.max(1,Math.min(300,Math.floor(Number(daily)||20)));ensureDailyOption(daily);saveSettings({mode:$('#mode').value,daily});pool=resize(daily);const task=renderTaskProgress();$('#reviewNotice').textContent=`已同步今日任务：当前 ${task.done}/${task.total} 个。点“今日背词”进入独立背词页。`;$('#reviewNotice').classList.remove('hidden');renderStats();renderAcceptance(task)}
$('#mode').onchange=()=>applyDaily(getSettings().daily||20);
$('#daily').onchange=()=>{if($('#daily').value!=='custom')return applyDaily($('#daily').value);const previous=getSettings().daily||20;ensureDailyOption(previous);$('#dailyCustomInput').value=previous;$('#dailyModal').classList.remove('hidden');$('#dailyCustomInput').focus()};
$('#cancelDaily').onclick=()=>$('#dailyModal').classList.add('hidden');
$('#confirmDaily').onclick=()=>{$('#dailyModal').classList.add('hidden');applyDaily($('#dailyCustomInput').value)};
$('#poolBtn').onclick=()=>{renderPool();
$('#poolModal').classList.remove('hidden')};
$('#closePool').onclick=()=>{$('#poolModal').classList.add('hidden');
pool=getPool();
repairTodayPool();
queue=pool.items.filter(x=>!pool.completed.includes(x)&&!todayDone(x));
index=0;
render()};
$('#fillPool').onclick=()=>{fill();
renderPool()};
$('#addWordBtn').onclick=()=>{add($('#addWord').value.trim());
$('#addWord').value='';
renderPool()};
$('#reviewBtn').onclick=()=>startReview('due');
$('#wrongBtn').onclick=openWrongModal;
$('#favoriteBtn').onclick=openFavoriteModal;
$('#learnedBtn').onclick=openLearnedModal;
if($('#favoriteToggle'))$('#favoriteToggle').onclick=()=>{const w=current();if(w)setFavorite(w.word,!getState().records[w.word]?.favorite)};
$('#closeWrong').onclick=()=>$('#wrongModal').classList.add('hidden');
$('#closeFavorite').onclick=()=>$('#favoriteModal').classList.add('hidden');
$('#closeLearned').onclick=()=>$('#learnedModal').classList.add('hidden');
$('#reviewFavorites').onclick=startFavoriteReview;
$('#reviewLearned').onclick=startLearnedReview;
document.addEventListener('click',e=>{const wrongCount=e.target.closest?.('[data-wrong-count]')?.dataset.wrongCount;if(wrongCount)startWrongReview(wrongCount)});
$('#quizBtn').onclick=()=>startQuiz();
$('#closeQuiz').onclick=()=>{$('#quizModal').classList.add('hidden');quiz=null};
if($('#closeStudy'))$('#closeStudy').onclick=()=>closeStudyWindow('已退出背词窗口，回到主页。');
let touchStartX=0,touchStartY=0,touchStartAt=0;
if($('#card')){$('#card').addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];if(!t)return;touchStartX=t.clientX;touchStartY=t.clientY;touchStartAt=Date.now()},{passive:true});
$('#card').addEventListener('touchend',e=>{const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-touchStartX,dy=t.clientY-touchStartY,dt=Date.now()-touchStartAt;if(dx>70&&Math.abs(dy)<55&&dt<800)goPreviousWord()},{passive:true})}
init();
startAutoSync((status,error)=>{
renderSyncStatus(status,error);
if(status==='ready'){pool=getPool();renderStats();const task=renderTaskProgress();renderAcceptance(task);$('#afterTask').classList.add('hidden')}
});
