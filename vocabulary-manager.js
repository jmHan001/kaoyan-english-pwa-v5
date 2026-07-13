export const KEYS={state:'ky5_state',settings:'ky5_settings',pool:'ky5_pool',migration:'ky5_migration'};
const fallback=[
 {word:'ability',translation:'n. 能力；才干',source:'both'},{word:'adapt',translation:'v. 适应；改编',source:'both'},{word:'assume',translation:'v. 假定；承担',source:'kaoyan'},{word:'benefit',translation:'n. 益处 v. 受益',source:'both'},{word:'challenge',translation:'n. 挑战 v. 质疑',source:'both'},{word:'decline',translation:'v. 下降；拒绝',source:'kaoyan'},{word:'evidence',translation:'n. 证据',source:'both'},{word:'feature',translation:'n. 特征 v. 以…为特色',source:'both'},{word:'generate',translation:'v. 产生',source:'kaoyan'},{word:'maintain',translation:'v. 保持；维护',source:'both'},{word:'perspective',translation:'n. 观点；视角',source:'kaoyan'},{word:'relevant',translation:'adj. 相关的',source:'kaoyan'}
];
let words=[];
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
export function getSettings(){return read(KEYS.settings,{mode:'smart',daily:20})}
export function saveSettings(v){localStorage.setItem(KEYS.settings,JSON.stringify(v))}
export function getState(){return read(KEYS.state,{records:{},rounds:{gaokao:1,kaoyan:1},streak:0,lastStudyDate:'',history:{}})}
export function saveState(v){localStorage.setItem(KEYS.state,JSON.stringify(v))}
export async function loadVocabulary(){
 const [g,k]=await Promise.all([fetch('./data/gaokao.json').then(r=>r.ok?r.json():[]).catch(()=>[]),fetch('./data/kaoyan.json').then(r=>r.ok?r.json():[]).catch(()=>[])]);
 const map=new Map();
 [...g.map(x=>({...x,source:'gaokao'})),...k.map(x=>({...x,source:'kaoyan'}))].forEach(x=>{const key=x.word.toLowerCase();const old=map.get(key);map.set(key,old?{...old,translation:old.translation||x.translation,source:'both'}:x)});
 words=[...map.values()]; if(!words.length) words=fallback; return words;
}
export function allWords(){return words}
export function findWord(s){return words.find(x=>x.word.toLowerCase()===String(s).toLowerCase())}
export function candidates(source,state=getState()){return words.filter(w=>(source==='all'||w.source===source||w.source==='both')&&!state.records[w.word]?.drawn)}
export function migrateLegacy(){
 if(localStorage.getItem(KEYS.migration)) return {done:true};
 try{const oldData=read('ky3_data',{}),oldPool=read('ky3_pool',[]),state=getState();Object.entries(oldData||{}).forEach(([word,v])=>state.records[word]={...(state.records[word]||{}),level:Number(v.level||v.mastery||0),errors:Number(v.errors||0),due:v.due||0,drawn:true});saveState(state);if(oldPool?.length&&!localStorage.getItem(KEYS.pool))localStorage.setItem(KEYS.pool,JSON.stringify({date:new Date().toISOString().slice(0,10),mode:'kaoyan',items:oldPool.map(x=>typeof x==='string'?x:x.word).filter(Boolean),completed:[]}));localStorage.setItem(KEYS.migration,JSON.stringify({at:Date.now(),ok:true}));return {done:true,migrated:Object.keys(oldData||{}).length}}
 catch(error){localStorage.setItem(KEYS.migration,JSON.stringify({at:Date.now(),ok:false,error:String(error)}));return {done:false,error:String(error)}}
}
export function exportAll(){const out={version:5,exportedAt:new Date().toISOString(),state:getState(),settings:getSettings(),pool:read(KEYS.pool,null),legacy:{ky3_words:localStorage.getItem('ky3_words'),ky3_data:localStorage.getItem('ky3_data'),ky3_settings:localStorage.getItem('ky3_settings'),ky3_pool:localStorage.getItem('ky3_pool')}};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download=`shici-backup-${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href)}
export async function importAll(file){const data=JSON.parse(await file.text());if(data.state)saveState(data.state);if(data.settings)saveSettings(data.settings);if(data.pool)localStorage.setItem(KEYS.pool,JSON.stringify(data.pool));location.reload()}
