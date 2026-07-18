import{getState,saveState}from'./vocabulary-manager.js';
import{localDateKey}from'./date-utils.js?v=5.8.0';

const gaps=[10*60e3,24*36e5,3*24*36e5,7*24*36e5,15*24*36e5];

export function rate(word,level,source){const s=getState(),old=s.records[word]||{},errors=(old.errors||0)+(level===1?1:0),step=level===1?0:Math.min((old.step||0)+1,gaps.length-1);
const correct=level>=3,correctStreak=correct?Math.min((old.correctStreak||0)+1,99):0,tailStage=correctStreak>=3,verifiedLevel=correct?(tailStage?4:3):level;
s.records[word]={...old,source:source||old.source,level:verifiedLevel,errors,step,due:Date.now()+gaps[step],lastSeen:Date.now(),drawn:true,correctStreak,tailStage};
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
const slayBackup={level:old.level||0,correctStreak:old.correctStreak||0,tailStage:!!old.tailStage,errors:old.errors||0,step:old.step||0,due:old.due||0,todayDoneDate:old.todayDoneDate||''};
s.records[word]={...old,source:source||old.source,drawn:true,slain:true,slainAt:Date.now(),slayBackup,level:4,correctStreak:3,tailStage:true,errors:0,step:0,due:0};
saveState(s);return s.records[word]}

export function restoreSlainWord(word){
const s=getState(),old=s.records[word]||{};
if(!old.slain)return old;
const next={...old,...(old.slayBackup||{level:0,correctStreak:0,tailStage:false,errors:0,step:0,due:0}),slain:false};
if(!next.todayDoneDate)delete next.todayDoneDate;delete next.slainAt;delete next.slayBackup;delete next.slainCompletedToday;s.records[word]=next;saveState(s);return next}
