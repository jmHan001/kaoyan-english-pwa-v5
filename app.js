import{loadVocabulary,findWord,allWords,getSettings,saveSettings,getState,migrateLegacy,exportAll}from'./vocabulary-manager.js';
import{getPool,remove,replace,toggleLock,add,fill}from'./learning-pool.js';
import{rate,dueWords,wrongWords}from'./review-manager.js';
import{stats}from'./stats.js';
import{rootHint,keyPoint,nearWords}from'./knowledge.js';
import{getSyncConfig,isConfigured,startAutoSync}from'./cloud-sync.js?v=5.6.3';

let pool,index=0,queue=[],reviewMode=false,currentOptions=[],answered=false;
const $=s=>document.querySelector(s),label={gaokao:'高考词',kaoyan:'考研词',both:'高考与考研共有'};
const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const formatTime=value=>value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未同步';

function shuffle(a){a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeOptions(word){const picked=[],seen=new Set([word.translation]);const all=allWords();let attempts=0;while(picked.length<3&&attempts<all.length*3){attempts++;const item=all[Math.floor(Math.random()*all.length)];if(!item||item.word===word.word||!item.translation||seen.has(item.translation))continue;seen.add(item.translation);picked.push(item)}return shuffle([word,...picked])}
function optionText(value){const text=String(value||'暂无释义').replace(/\s+/g,' ').trim();return text.length>82?`${text.slice(0,82)}…`:text}
function renderChoices(word){currentOptions=makeOptions(word);const wrap=$('#choices');wrap.innerHTML='';currentOptions.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.className='choice-option';button.dataset.choice=String(i);const key=document.createElement('span');key.className='choice-key';key.textContent=String.fromCharCode(65+i);const text=document.createElement('span');text.textContent=optionText(item.translation);button.append(key,text);wrap.append(button)})}

function renderStats(){const x=stats();
$('#stats').innerHTML=`<div class="stat"><strong>${x.gaokao.rate}%</strong><span>高考掌握率 · ${x.gaokao.mastered}/${x.gaokao.total}</span></div><div class="stat"><strong>${x.kaoyan.rate}%</strong><span>考研掌握率 · ${x.kaoyan.mastered}/${x.kaoyan.total}</span></div><div class="stat"><strong>${x.due}</strong><span>到期复习</span></div><div class="stat"><strong>${x.streak} 天</strong><span>连续学习</span></div>`}
function renderTaskProgress(){if(!pool)return{total:0,done:0};const total=pool.items.length,completed=new Set(pool.completed||[]),done=pool.items.filter(word=>completed.has(word)).length,remaining=Math.max(0,total-done),progress=$('#todayProgress');$('#todayCount').textContent=`${done} / ${total}`;$('#todayRemaining').textContent=total?(remaining?`还剩 ${remaining} 个单词需要答对`:'今日任务已全部答对'):'学习池为空，请在编辑学习池中添加单词';progress.max=Math.max(1,total);progress.value=done;$('#todayTask').classList.toggle('complete',total>0&&done===total);return{total,done}}
function renderSyncStatus(status='idle',error=null){const el=$('#syncStatus');if(!el)return;const configured=isConfigured(getSyncConfig()),meta=readJson('ky5_sync_meta',{});el.className=`sync-pill ${configured?'configured':'missing'} ${status}`;if(status==='busy')el.textContent='正在同步';else if(status==='error')el.textContent=`同步异常 · ${String(error?.message||error||'点此处理').slice(0,22)}`;else el.textContent=configured?`已同步 · ${formatTime(meta.lastSyncAt||meta.lastAppliedAt)}`:'未绑定同步';}
function actionCard(kind,title,value,copy,action){return`<button class="next-card ${kind}" data-home-action="${action}"><strong>${value}</strong><span>${title}</span><small>${copy}</small></button>`}
function renderAfterTask(task){if(!pool)return;const wrap=$('#afterTask');const due=dueWords(),wrong=wrongWords(),completed=new Set(pool.completed||[]);const learned=pool.items.map(word=>{const w=findWord(word),done=completed.has(word);return`<span class="word-chip ${done?'done':'open'}">${word}<small>${done?'已完成':'未完成'}</small>${w?.source?`<em>${label[w.source]||'自定义'}</em>`:''}</span>`}).join('');wrap.innerHTML=`<div class="after-head"><div><span class="section-kicker">今天收尾</span><h2>${task.done}/${task.total} 已完成</h2><p>新词任务已经闭环。接下来优先处理到期复习和错词，不需要再随机冒出新词。</p></div><button class="btn secondary" data-home-action="pool">查看学习池</button></div><div class="next-grid">${actionCard('review','到期复习',due.length,'先处理今天该回来的词','review')}${actionCard('wrong','错词回炉',wrong.length,'把连续错的词再过一遍','wrong')}<a class="next-card reading" href="reading.html"><strong>阅读</strong><span>阅读理解</span><small>用文章检查单词是否真的会用</small></a><a class="next-card lookup" href="lookup.html"><strong>查</strong><span>查词补漏</span><small>不会的词手动加入学习池</small></a></div><section class="learned-panel"><div class="learned-head"><h3>今日学习池</h3><small>${pool.date||'今天'} · 固定 ${pool.items.length} 词</small></div><div class="word-chip-list">${learned||'<span class="empty">学习池为空</span>'}</div></section>`;wrap.classList.remove('hidden')}
function chunks(word){const parts=word.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]*[aeiouy])|[^aeiouy]*$)/gi);return parts?.length>1?parts.join(' · '):word}function current(){return findWord(queue[index])}function render(){const w=current();
answered=false;
$('#memoryPack').classList.add('hidden');
$('#recallCue').classList.remove('hidden');
$('#choiceFeedback').classList.add('hidden');
$('#nextWord').classList.add('hidden');
$('#reveal').classList.remove('hidden');
if(!w){$('#card').classList.add('hidden');
$('#done').classList.remove('hidden');
const task=renderTaskProgress();
if(!reviewMode&&task.total>0&&task.done===task.total)$('#done').textContent=`今日任务已完成：${task.done}/${task.total}。连续正确次数会在后续复习中继续累计。`;
renderAfterTask(task);
return}$('#card').classList.remove('hidden');
$('#afterTask').classList.add('hidden');
$('#done').classList.add('hidden');
$('#word').textContent=w.word;
$('#meaning').textContent=w.translation||'暂无释义';
$('#source').textContent=label[w.source]||'自定义词';
const rec=getState().records[w.word]||{};
$('#memoryBadge').textContent=rec.tailStage?'长时记忆尾期':`连续正确 ${rec.correctStreak||0}/3`;
$('#memoryBadge').classList.toggle('tail',!!rec.tailStage);
$('#phonetic').textContent='';
renderChoices(w);
$('#syllable').textContent=`拆着记：${chunks(w.word)}`;
const examples=Array.isArray(w.sentences)?w.sentences:(w.sentences?.sentence?[w.sentences]:[]),phrases=Array.isArray(w.phrases)?w.phrases:(w.phrases?.phrase?[w.phrases]:[]),near=nearWords(w,allWords());
$('#example').innerHTML=examples[0]?.sentence?examples[0].sentence.replace(new RegExp(`(${w.word})`,'ig'),'<strong>$1</strong>'):'暂无可靠例句。';
$('#exampleCn').textContent=examples[0]?.translation||'';
$('#wordKnowledge').innerHTML=`<div class="detail-grid"><section class="detail-section"><h3>高频考点</h3><p class="exam-point">${keyPoint(w)}</p></section><section class="detail-section"><h3>词组搭配</h3>${phrases.length?phrases.slice(0,4).map(p=>`<p><strong>${p.phrase}</strong>　${p.translation}</p>`).join(''):'<p>暂无搭配数据</p>'}</section><section class="detail-section"><h3>词根提示</h3><p>${rootHint(w.word)}</p></section><section class="detail-section"><h3>近义关联</h3><p>${near.length?near.map(x=>`<span class="chip">${x.word}</span>`).join(' '):'暂无可靠近义关联'}</p></section><section class="detail-section"><h3>更多例句</h3>${examples.slice(1,3).map(x=>`<p class="example">${x.sentence}</p><p class="example-cn">${x.translation||''}</p>`).join('')||'<p>暂无更多例句</p>'}</section></div>`}
function renderPool(){pool=getPool();
renderTaskProgress();
$('#poolList').innerHTML=pool.items.map(w=>{const x=findWord(w);
return`<div class="row"><div><strong>${w}</strong><small>${x?.translation||''}</small></div><div class="row-actions"><button class="iconbtn" data-lock="${w}" title="锁定">${pool.locked?.includes(w)?'锁':'固'}</button><button class="iconbtn" data-replace="${w}" title="替换">换</button><button class="iconbtn" data-remove="${w}" title="删除">删</button></div></div>`}).join('')||'<div class="empty">学习池为空</div>'}
function startReview(type='due'){queue=type==='wrong'?wrongWords():dueWords();const notice=$('#reviewNotice');if(!queue.length&&type==='due'){queue=wrongWords();notice.textContent=queue.length?'暂无到期词，已为你打开错词回炉。':'暂无到期复习。先完成几个新词，完全不会的词会在本轮 3 个词后再次出现。'}else if(!queue.length){notice.textContent='暂无错词。今天可以去阅读或查词补漏。'}else{notice.textContent=type==='wrong'?`本次打开 ${queue.length} 个错词。`:`本次有 ${queue.length} 个到期词。`}notice.classList.remove('hidden');reviewMode=true;index=0;render()}
function speak(lang){const w=current();
if(!w)return;
const u=new SpeechSynthesisUtterance(w.word);
u.lang=lang;
u.rate=.86;
speechSynthesis.cancel();
speechSynthesis.speak(u)}
function finishChoice(correct,selectedIndex=-1){if(answered)return;const w=current();if(!w)return;answered=true;const record=rate(w.word,correct?3:1,w.source);if(!correct)queue.splice(Math.min(index+4,queue.length),0,w.word);if(!reviewMode){const completed=new Set(pool.completed||[]);if(correct)completed.add(w.word);else completed.delete(w.word);pool.completed=[...completed];localStorage.setItem('ky5_pool',JSON.stringify(pool));renderTaskProgress()}const buttons=[...document.querySelectorAll('.choice-option')];buttons.forEach((button,i)=>{button.disabled=true;if(currentOptions[i]?.word===w.word)button.classList.add('correct');else if(i===selectedIndex)button.classList.add('wrong')});$('#phonetic').textContent=`美 /${w.us||'暂无'}/　英 /${w.uk||'暂无'}/`;$('#memoryPack').classList.remove('hidden');$('#recallCue').classList.add('hidden');$('#reveal').classList.add('hidden');$('#nextWord').classList.remove('hidden');const feedback=$('#choiceFeedback');feedback.textContent=correct?(record.correctStreak>=3?'回答正确，已连续正确 3 次，标记为已掌握。':`回答正确，连续正确 ${record.correctStreak}/3。`):'本次未计入今日完成，连续正确已清零，并加入本轮回炉。';feedback.className=`choice-feedback ${correct?'correct':'wrong'}`;$('#memoryBadge').textContent=record.tailStage?'已连续正确 3 次':`连续正确 ${record.correctStreak||0}/3`;$('#memoryBadge').classList.toggle('tail',!!record.tailStage);renderStats()}
async function init(){await loadVocabulary();
const mig=migrateLegacy();
const s=getSettings();
$('#mode').value=s.mode;
$('#daily').value=String(s.daily);
pool=getPool();
const verifiedCompleted=pool.completed.filter(word=>(getState().records[word]?.level||0)>=3);
if(verifiedCompleted.length!==pool.completed.length){pool.completed=verifiedCompleted;localStorage.setItem('ky5_pool',JSON.stringify(pool))}
queue=pool.items.filter(x=>!pool.completed.includes(x));
renderStats();
renderTaskProgress();
renderSyncStatus();
render();
if(!mig.done)$('#done').innerHTML=`旧数据迁移失败。<button class="btn" id="backupOld">导出旧数据</button>`;
if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.register('./sw.js');
reg.addEventListener('updatefound',()=>{const worker=reg.installing;
worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){document.body.insertAdjacentHTML('beforeend','<div class="update">发现新版本 <button class="btn accent" onclick="location.reload()">点击更新</button></div>')}})})}}
$('#reveal').onclick=()=>finishChoice(false);
$('#nextWord').onclick=()=>{index++;render()};
document.addEventListener('click',e=>{const v=e.target.dataset.voice;
if(v)speak(v);
const action=e.target.closest?.('[data-home-action]')?.dataset.homeAction;
if(action==='review')startReview('due');
if(action==='wrong')startReview('wrong');
if(action==='pool'){$('#poolBtn').click()}
const choice=e.target.closest?.('[data-choice]');if(choice)finishChoice(currentOptions[Number(choice.dataset.choice)]?.word===current()?.word,Number(choice.dataset.choice));
if(e.target.dataset.remove){remove(e.target.dataset.remove);
renderPool()}if(e.target.dataset.replace){replace(e.target.dataset.replace);
renderPool()}if(e.target.dataset.lock){toggleLock(e.target.dataset.lock);
renderPool()}});
$('#mode').onchange=$('#daily').onchange=()=>{saveSettings({mode:$('#mode').value,daily:Number($('#daily').value)});
pool=getPool();
$('#reviewNotice').textContent='设置已保存，将从下一个学习日生效。今日学习池保持固定，如需改动请使用“编辑学习池”。';
$('#reviewNotice').classList.remove('hidden');
renderStats()};
$('#poolBtn').onclick=()=>{renderPool();
$('#poolModal').classList.remove('hidden')};
$('#closePool').onclick=()=>{$('#poolModal').classList.add('hidden');
pool=getPool();
queue=pool.items.filter(x=>!pool.completed.includes(x));
index=0;
render()};
$('#fillPool').onclick=()=>{fill();
renderPool()};
$('#addWordBtn').onclick=()=>{add($('#addWord').value.trim());
$('#addWord').value='';
renderPool()};
$('#reviewBtn').onclick=()=>startReview('due');
init();
startAutoSync((status,error)=>{
renderSyncStatus(status,error);
if(status==='ready'){pool=getPool();renderStats();const task=renderTaskProgress();if(!current())renderAfterTask(task)}
});
