export const KEYS={state:'ky5_state',settings:'ky5_settings',pool:'ky5_pool',migration:'ky5_migration'};
import{localDateKey}from'./date-utils.js?v=6.0.0';
const fallback=[
 {word:'ability',translation:'n. 能力；才干',source:'both'},{word:'adapt',translation:'v. 适应；改编',source:'both'},{word:'assume',translation:'v. 假定；承担',source:'kaoyan'},{word:'benefit',translation:'n. 益处 v. 受益',source:'both'},{word:'challenge',translation:'n. 挑战 v. 质疑',source:'both'},{word:'decline',translation:'v. 下降；拒绝',source:'kaoyan'},{word:'evidence',translation:'n. 证据',source:'both'},{word:'feature',translation:'n. 特征 v. 以…为特色',source:'both'},{word:'generate',translation:'v. 产生',source:'kaoyan'},{word:'maintain',translation:'v. 保持；维护',source:'both'},{word:'perspective',translation:'n. 观点；视角',source:'kaoyan'},{word:'relevant',translation:'adj. 相关的',source:'kaoyan'}
];
let words=[],wordMap=new Map();
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const normalizedWord=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ').replace(/’/g,"'");
function sanitizeVocabularyValue(value){
 if(typeof value==='string')return value.replace(/[\u00ad\u200b\ue000-\uf8ff]/gi,'');
 if(Array.isArray(value))return value.map(sanitizeVocabularyValue);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,sanitizeVocabularyValue(item)]));
 return value;
}
function mergeWord(primary,fallback,source){
 const merged={...fallback,...primary,source};
 for(const key of ['translation','us','uk','phrases','sentences'])if(!merged[key]&&fallback?.[key])merged[key]=fallback[key];
 return merged;
}
function uniqueSource(items,source){
 const map=new Map();
 for(const raw of items||[]){const item=sanitizeVocabularyValue(raw),key=normalizedWord(item?.word);if(!key)continue;const old=map.get(key);map.set(key,old?mergeWord(old,item,source):{...item,word:String(item.word).trim(),source})}
 return map;
}
export function getSettings(){return read(KEYS.settings,{mode:'smart',daily:20})}
export function saveSettings(v){localStorage.setItem(KEYS.settings,JSON.stringify({...v,updatedAt:Date.now()}))}
export function getState(){return read(KEYS.state,{records:{},rounds:{gaokao:1,kaoyan:1},streak:0,lastStudyDate:'',history:{}})}
export function saveState(v){localStorage.setItem(KEYS.state,JSON.stringify(v))}
export async function loadVocabulary(){
 const [g,k]=await Promise.all([fetch('./data/gaokao.json').then(r=>r.ok?r.json():[]).catch(()=>[]),fetch('./data/kaoyan.json').then(r=>r.ok?r.json():[]).catch(()=>[])]);
 const gaokao=uniqueSource(g,'gaokao'),kaoyan=uniqueSource(k,'kaoyan'),map=new Map(gaokao);
 for(const [key,item]of kaoyan){const old=map.get(key);map.set(key,old?mergeWord(old,item,'both'):item)}
 words=[...map.values()]; if(!words.length) words=fallback;wordMap=new Map(words.map(word=>[normalizedWord(word.word),word]));return words;
}
export function allWords(){return words}
const irregular={children:'child',men:'man',women:'woman',people:'person',teeth:'tooth',feet:'foot',mice:'mouse',geese:'goose',went:'go',gone:'go',done:'do',did:'do',seen:'see',saw:'see',made:'make',taken:'take',took:'take',given:'give',gave:'give',known:'know',knew:'know',thought:'think',bought:'buy',brought:'bring',found:'find',felt:'feel',left:'leave',kept:'keep',held:'hold',written:'write',wrote:'write',read:'read'};
function wordForms(value){const word=String(value||'').toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g,'').replace(/['’]s$/,'');const out=[word],add=x=>{if(x&&x.length>1&&!out.includes(x))out.push(x)};if(irregular[word])add(irregular[word]);if(word.length>4&&word.endsWith('ies'))add(`${word.slice(0,-3)}y`);if(word.length>4&&word.endsWith('ves')){add(`${word.slice(0,-3)}f`);add(`${word.slice(0,-3)}fe`)}if(word.length>4&&word.endsWith('es')){add(word.slice(0,-2));add(word.slice(0,-1))}else if(word.length>3&&word.endsWith('s'))add(word.slice(0,-1));if(word.length>5&&word.endsWith('ied'))add(`${word.slice(0,-3)}y`);if(word.length>4&&word.endsWith('ed')){const stem=word.slice(0,-2);add(stem);add(`${stem}e`);if(stem.at(-1)===stem.at(-2))add(stem.slice(0,-1))}if(word.length>5&&word.endsWith('ing')){const stem=word.slice(0,-3);add(stem);add(`${stem}e`);if(stem.at(-1)===stem.at(-2))add(stem.slice(0,-1))}return out}
export function findWord(s){const direct=wordMap.get(normalizedWord(s));if(direct)return direct;for(const form of wordForms(s)){const found=wordMap.get(form);if(found)return found}return undefined}
export function candidates(source,state=getState()){return words.filter(w=>(source==='all'||w.source===source||w.source==='both')&&!state.records[w.word]?.drawn)}
export function migrateLegacy(){
 if(localStorage.getItem(KEYS.migration)) return {done:true};
 try{const oldData=read('ky3_data',{}),oldPool=read('ky3_pool',[]),state=getState();Object.entries(oldData||{}).forEach(([word,v])=>state.records[word]={...(state.records[word]||{}),level:Number(v.level||v.mastery||0),errors:Number(v.errors||0),due:v.due||0,drawn:true});saveState(state);if(oldPool?.length&&!localStorage.getItem(KEYS.pool))localStorage.setItem(KEYS.pool,JSON.stringify({date:localDateKey(),mode:'kaoyan',items:oldPool.map(x=>typeof x==='string'?x:x.word).filter(Boolean),completed:[]}));localStorage.setItem(KEYS.migration,JSON.stringify({at:Date.now(),ok:true}));return {done:true,migrated:Object.keys(oldData||{}).length}}
 catch(error){localStorage.setItem(KEYS.migration,JSON.stringify({at:Date.now(),ok:false,error:String(error)}));return {done:false,error:String(error)}}
}
export function exportAll(){const out={version:5,exportedAt:new Date().toISOString(),state:getState(),settings:getSettings(),pool:read(KEYS.pool,null),legacy:{ky3_words:localStorage.getItem('ky3_words'),ky3_data:localStorage.getItem('ky3_data'),ky3_settings:localStorage.getItem('ky3_settings'),ky3_pool:localStorage.getItem('ky3_pool')}};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download=`shici-backup-${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href)}
export async function importAll(file){const data=JSON.parse(await file.text());if(data.state)saveState(data.state);if(data.settings)saveSettings(data.settings);if(data.pool)localStorage.setItem(KEYS.pool,JSON.stringify(data.pool));location.reload()}
