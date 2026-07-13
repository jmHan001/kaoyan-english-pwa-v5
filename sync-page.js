import{getSyncConfig,saveSyncConfig,clearSyncConfig,isConfigured,createSyncId,syncNow,exportSyncFile,importSyncFile,startAutoSync}from'./cloud-sync.js';
const $=s=>document.querySelector(s),config=getSyncConfig();
const fields={endpoint:$('#endpoint'),anonKey:$('#anonKey'),syncId:$('#syncId'),passphrase:$('#passphrase'),autoSync:$('#autoSync')};
for(const[k,el]of Object.entries(fields)){if(k==='autoSync')el.checked=config.autoSync!==false;else el.value=config[k]||''}
function status(kind,title,text){$('#statusDot').className=`status-dot ${kind||''}`;$('#statusTitle').textContent=title;$('#statusText').textContent=text;$('#syncNow').disabled=!isConfigured(getSyncConfig())||kind==='busy'}
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),2800)}
function fmt(t){return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(t)}
function setReady(){const c=getSyncConfig(),meta=JSON.parse(localStorage.getItem('ky5_sync_meta')||'{}');if(isConfigured(c))status('ready','云同步已配置',meta.lastSyncAt?`上次同步：${fmt(meta.lastSyncAt)}`:'点击立即同步完成首次连接');else status('','尚未配置云同步','你也可以先使用下方的同步文件完成一次迁移。')}
async function run(){status('busy','正在同步','正在合并本机与云端记录，请不要关闭页面。');try{const result=await syncNow();status('ready','同步完成',`${fmt(Date.now())} · ${result.hadRemote?'已合并两端记录':'已建立首份云端记录'}`);toast('电脑与手机数据已同步')}catch(error){status('error','同步失败',error.message);throw error}}
$('#syncForm').onsubmit=async e=>{e.preventDefault();saveSyncConfig({endpoint:fields.endpoint.value,anonKey:fields.anonKey.value,syncId:fields.syncId.value,passphrase:fields.passphrase.value,autoSync:fields.autoSync.checked});try{await run()}catch{}}
$('#syncNow').onclick=()=>run().catch(()=>{});
$('#newCode').onclick=()=>{fields.syncId.value=createSyncId();toast('已生成新的同步码')};
$('#copyCode').onclick=async()=>{if(!fields.syncId.value)return toast('请先生成同步码');await navigator.clipboard.writeText(fields.syncId.value);toast('同步码已复制')};
$('#disconnect').onclick=()=>{if(!confirm('只停用本机云同步，不会删除本地学习记录。继续吗？'))return;clearSyncConfig();for(const[k,el]of Object.entries(fields)){if(k==='autoSync')el.checked=true;else el.value=''}setReady();toast('已停用本机云同步')};
$('#exportFile').onclick=()=>{exportSyncFile();$('#fileResult').textContent='同步文件已导出，请发送到另一台设备后导入。'};
$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await importSyncFile(file);$('#fileResult').textContent='导入并合并成功。返回学习页即可看到同步后的记录。';toast('学习数据已合并')}catch(error){$('#fileResult').textContent=`导入失败：${error.message}`}e.target.value=''};
setReady();startAutoSync((kind,error)=>{if(kind==='busy')status('busy','正在自动同步','正在检查另一台设备的新记录。');else if(kind==='ready')setReady();else status('error','自动同步失败',error.message)});
