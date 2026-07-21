import{allWords,getState,getSettings}from'./vocabulary-manager.js';
import{dueWords,wrongWords}from'./review-manager.js?v=6.0.0';
import{memoryStage,memorySummary}from'./memory-engine.js?v=6.0.0';

export function stats(){
  const all=allWords(),state=getState(),calc=source=>{
    const list=all.filter(word=>word.source===source||word.source==='both'),drawn=list.filter(word=>state.records[word.word]?.drawn).length,mastered=list.filter(word=>memoryStage(state.records[word.word]||{})==='mastered').length,verification=list.filter(word=>['recognition','recall','context','relearning'].includes(memoryStage(state.records[word.word]||{}))).length;
    return{total:list.length,drawn,mastered,verification,rate:list.length?Math.round(mastered/list.length*100):0};
  };
  return{gaokao:calc('gaokao'),kaoyan:calc('kaoyan'),mode:getSettings().mode,due:dueWords().length,wrong:wrongWords().length,streak:state.streak||0,memory:memorySummary(state.records)};
}
