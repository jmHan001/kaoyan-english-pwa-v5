import{getState,saveState}from'./vocabulary-manager.js';

const gaps=[10*60e3,24*36e5,3*24*36e5,7*24*36e5,15*24*36e5];

export function rate(word,level,source){const s=getState(),old=s.records[word]||{},errors=(old.errors||0)+(level===1?1:0),step=level===1?0:Math.min((old.step||0)+1,gaps.length-1);
const correct=level>=3,correctStreak=correct?Math.min((old.correctStreak||0)+1,99):0,tailStage=correctStreak>=3;
s.records[word]={...old,source:source||old.source,level,errors,step,due:Date.now()+gaps[step],lastSeen:Date.now(),drawn:true,correctStreak,tailStage};
const d=new Date().toISOString().slice(0,10);
s.history[d]=(s.history[d]||0)+1;
if(s.lastStudyDate!==d){s.streak=(s.lastStudyDate&&Date.now()-new Date(s.lastStudyDate).getTime()<48*36e5)?(s.streak||0)+1:1;
s.lastStudyDate=d}saveState(s);
return s.records[word]}
export function dueWords(){const s=getState();
return Object.entries(s.records).filter(([,r])=>r.due&&r.due<=Date.now()).sort((a,b)=>a[1].due-b[1].due).map(([word])=>word)}
export function wrongWords(){const s=getState();
return Object.entries(s.records).filter(([,r])=>(r.errors||0)>0).sort((a,b)=>(b[1].errors||0)-(a[1].errors||0)).map(([word])=>word)}
