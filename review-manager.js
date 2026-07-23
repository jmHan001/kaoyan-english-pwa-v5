import{getState,saveState}from'./vocabulary-manager.js';
import{localDateKey}from'./date-utils.js?v=6.0.0';
import{MEMORY_VERSION,upgradeMemoryRecord,recordMemoryAnswer,memoryStage}from'./memory-engine.js?v=6.1.1';

export function migrateMemoryModel(){const s=getState();let migrated=0;for(const[word,value]of Object.entries(s.records||{})){if(Number(value?.memoryVersion)>=MEMORY_VERSION)continue;s.records[word]=upgradeMemoryRecord(value);migrated++}if(Number(s.memoryVersion)<MEMORY_VERSION||migrated){s.memoryVersion=MEMORY_VERSION;saveState(s)}return{done:true,migrated}}

export function rate(word,result,source){const s=getState(),old=s.records[word]||{},at=Date.now(),answer=typeof result==='object'?{...result}:{correct:Number(result)>=3,kind:'recognition'};
s.records[word]={...recordMemoryAnswer(old,{...answer,at,date:localDateKey(at)}),source:source||old.source,updatedAt:at};
const d=localDateKey();
s.history[d]=(s.history[d]||0)+1;
if(s.lastStudyDate!==d){s.streak=(s.lastStudyDate&&Date.now()-new Date(s.lastStudyDate).getTime()<48*36e5)?(s.streak||0)+1:1;
s.lastStudyDate=d}saveState(s);
return s.records[word]}
export function dueWords(){const s=getState();
return Object.entries(s.records).filter(([,r])=>!r.slain&&r.due&&r.due<=Date.now()).sort((a,b)=>a[1].due-b[1].due).map(([word])=>word)}
export function wrongWords(){const s=getState();
return Object.entries(s.records).filter(([,r])=>!r.slain&&(r.errors||0)>0).sort((a,b)=>(b[1].errors||0)-(a[1].errors||0)).map(([word])=>word)}

export function slayWord(word,source){
const s=getState(),old=s.records[word]||{};
if(old.slain)return old;
const updatedAt=Date.now();s.records[word]={...old,source:source||old.source,drawn:true,slain:true,slainAt:updatedAt,updatedAt,slayPreviousStage:memoryStage(old)};
saveState(s);return s.records[word]}

export function restoreSlainWord(word){
const s=getState(),old=s.records[word]||{};
if(!old.slain)return old;
const next={...old,...(old.slayBackup||{}),slain:false,updatedAt:Date.now()};
if(!next.todayDoneDate)delete next.todayDoneDate;delete next.slainAt;delete next.slayBackup;delete next.slainCompletedToday;s.records[word]=next;saveState(s);return next}
