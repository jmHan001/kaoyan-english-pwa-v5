import{getSyncConfig,saveSyncConfig,clearSyncConfig,isConfigured,createSyncId,syncNow,exportSyncFile,importSyncFile,startAutoSync}from'./cloud-sync.js?v=6.0.0';
import{migrateMemoryModel}from'./review-manager.js?v=6.1.1';
migrateMemoryModel();
const $=s=>document.querySelector(s),config=getSyncConfig();
const fields={endpoint:$('#endpoint'),anonKey:$('#anonKey'),syncId:$('#syncId'),passphrase:$('#passphrase'),autoSync:$('#autoSync')};
for(const[k,el]of Object.entries(fields)){if(k==='autoSync')el.checked=config.autoSync!==false;else el.value=config[k]||''}
function status(kind,title,text){$('#statusDot').className=`status-dot ${kind||''}`;$('#statusTitle').textContent=title;$('#statusText').textContent=text;$('#syncNow').disabled=!isConfigured(getSyncConfig())||kind==='busy'}
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),2800)}
function fmt(t){return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(t)}
function renderSummary(summary){const x=summary||{};$('#syncSummaryGrid').innerHTML=`<div class="stat"><strong>${x.poolDone||0}/${x.poolTotal||0}</strong><span>今日学习池</span></div><div class="stat"><strong>${x.records||0}</strong><span>学习记录</span></div><div class="stat"><strong>${x.mastered||0}</strong><span>长期掌握</span></div><div class="stat"><strong>${x.verification||0}</strong><span>学习中与待验证</span></div><div class="stat"><strong>${x.wrong||0}</strong><span>错词</span></div><div class="stat"><strong>${x.favorites||0}</strong><span>收藏</span></div><div class="stat"><strong>${x.sentences||0}</strong><span>长难句</span></div>`}
function randomPassphrase(){const bytes=crypto.getRandomValues(new Uint8Array(24));return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g,'').slice(0,28)}
function encodePair(){const value={v:1,syncId:fields.syncId.value.trim(),passphrase:fields.passphrase.value};return btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decodePair(value){const padded=String(value||'').replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(escape(atob(padded+'='.repeat((4-padded.length%4)%4)))))}
function pairingLink(){if(!fields.syncId.value.trim()||fields.passphrase.value.length<8)throw new Error('请先生成配对信息');return`${location.origin}${location.pathname}#pair=${encodePair()}`}
function applyPair(value){const source=String(value||'').trim(),token=source.includes('#pair=')?source.split('#pair=')[1]:source,pair=decodePair(token);if(pair.v!==1||!pair.syncId||!pair.passphrase)throw new Error('配对链接无效');fields.syncId.value=pair.syncId;fields.passphrase.value=pair.passphrase;status('','已读取电脑配对信息','点击“保存并同步”，即可打开本机持续互通。')}
function setReady(){const c=getSyncConfig(),meta=JSON.parse(localStorage.getItem('ky5_sync_meta')||'{}');renderSummary(meta.summary);if(isConfigured(c))status('ready','云同步已配置',meta.lastSyncAt?`上次同步：${fmt(meta.lastSyncAt)}`:'点击立即同步完成首次连接');else status('','尚未配置云同步','你也可以先使用下方的同步文件完成一次迁移。')}
async function run(){status('busy','正在同步','正在合并本机与云端记录，请不要关闭页面。');try{const result=await syncNow();renderSummary(result.summary);status('ready','同步完成',`${fmt(Date.now())} · ${result.hadRemote?'已合并两端记录':'已建立首份云端记录'}`);toast('电脑与手机数据已同步')}catch(error){status('error','同步失败',error.message);throw error}}
$('#syncForm').onsubmit=async e=>{e.preventDefault();saveSyncConfig({endpoint:fields.endpoint.value,anonKey:fields.anonKey.value,syncId:fields.syncId.value,passphrase:fields.passphrase.value,autoSync:fields.autoSync.checked});try{await run()}catch{}}
$('#syncNow').onclick=()=>run().catch(()=>{});
$('#newCode').onclick=()=>{fields.syncId.value=createSyncId();toast('已生成新的同步码')};
$('#copyCode').onclick=async()=>{if(!fields.syncId.value)return toast('请先生成同步码');await navigator.clipboard.writeText(fields.syncId.value);toast('同步码已复制')};
$('#newPair').onclick=()=>{fields.syncId.value=createSyncId();fields.passphrase.value=randomPassphrase();toast('已生成安全配对信息，请保存并同步')};
$('#copyPair').onclick=async()=>{try{await navigator.clipboard.writeText(pairingLink());toast('手机配对链接已复制，可发送到 iPhone')}catch(error){toast(error.message)}};
$('#applyPair').onclick=()=>{try{applyPair($('#pairLink').value);$('#pairLink').value='';toast('配对信息读取成功')}catch(error){toast(error.message)}};
$('#disconnect').onclick=()=>{if(!confirm('只停用本机云同步，不会删除本地学习记录。继续吗？'))return;clearSyncConfig();for(const[k,el]of Object.entries(fields)){if(k==='autoSync')el.checked=true;else el.value=''}setReady();toast('已停用本机云同步')};
$('#exportFile').onclick=()=>{exportSyncFile();$('#fileResult').textContent='同步文件已导出，请发送到另一台设备后导入。'};
$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await importSyncFile(file);$('#fileResult').textContent='导入并合并成功。返回学习页即可看到同步后的记录。';toast('学习数据已合并')}catch(error){$('#fileResult').textContent=`导入失败：${error.message}`}e.target.value=''};
if(location.hash.startsWith('#pair=')){try{applyPair(location.hash.slice(6));history.replaceState(null,'',location.pathname)}catch{toast('配对链接无效，请重新从电脑复制')}}else setReady();
startAutoSync((kind,error)=>{if(kind==='busy')status('busy','正在自动同步','正在检查另一台设备的新记录。');else if(kind==='ready')setReady();else if(kind==='offline')status('offline','当前离线，本机继续保存','恢复联网后会立即尝试补同步，不影响现在学习。');else status('error','自动同步失败',error?.message||'请检查网络后重试')});
