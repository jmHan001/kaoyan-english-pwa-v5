const DAY=24*60*60*1000;
const MINUTE=60*1000;
export const MEMORY_VERSION=3;
export const STAGES={
  new:{label:'初见',level:0},
  recognition:{label:'已接触',level:2},
  recall:{label:'能想起',level:3},
  context:{label:'待语境验证',level:3},
  mastered:{label:'已掌握',level:4},
  relearning:{label:'重新巩固',level:1},
  slain:{label:'已斩',level:0}
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const uniqueDates=values=>[...new Set((Array.isArray(values)?values:[]).map(String).filter(Boolean))].sort();
const archiveDates=(history,current)=>uniqueDates([...(Array.isArray(history)?history:[]),...(Array.isArray(current)?current:[])]).slice(-120);

export function upgradeMemoryRecord(value={}){
  if(value.memoryVersion>=MEMORY_VERSION){
    return{
      ...value,
      recognitionCount:Math.max(0,Number(value.recognitionCount)||0),
      acquisitionSuccessCount:Math.max(0,Number(value.acquisitionSuccessCount)||0),
      acquisitionMisses:Math.max(0,Number(value.acquisitionMisses)||0),
      exposureDates:uniqueDates(value.exposureDates),
      recallPassDates:uniqueDates(value.recallPassDates),
      contextPassDates:uniqueDates(value.contextPassDates),
      recallHistoryDates:uniqueDates(value.recallHistoryDates),
      contextHistoryDates:uniqueDates(value.contextHistoryDates),
      stabilityDays:clamp(value.stabilityDays||1,.25,3650),
      difficulty:clamp(value.difficulty||5,1,10),
      lapses:Math.max(0,Number(value.lapses)||0)
    };
  }
  if(Number(value.memoryVersion)>=2){
    return{
      ...value,
      memoryVersion:MEMORY_VERSION,
      recognitionCount:Math.max(0,Number(value.recognitionCount)||0),
      acquisitionSuccessCount:Math.max(0,Number(value.acquisitionSuccessCount)||0),
      acquisitionMisses:Math.max(0,Number(value.acquisitionMisses)||0),
      exposureDates:uniqueDates(value.exposureDates),
      recallPassDates:uniqueDates(value.recallPassDates),
      contextPassDates:uniqueDates(value.contextPassDates),
      recallHistoryDates:uniqueDates(value.recallHistoryDates),
      contextHistoryDates:uniqueDates(value.contextHistoryDates),
      stabilityDays:clamp(value.stabilityDays||1,.25,3650),
      difficulty:clamp(value.difficulty||5,1,10),
      lapses:Math.max(0,Number(value.lapses)||0)
    };
  }
  // “已抽入学习池”不等于“已经识别正确”；只有真实作答痕迹才进入能认阶段。
  const seen=Boolean(value.lastSeen||value.level||value.errors||value.correctStreak||value.tailStage);
  const legacyQualified=Boolean(value.tailStage||Number(value.level)>=4);
  return{
    ...value,
    memoryVersion:MEMORY_VERSION,
    recognitionCount:seen?Math.max(1,Number(value.correctStreak)||0):0,
    acquisitionSuccessCount:0,
    acquisitionMisses:0,
    exposureDates:[],
    recallPassDates:[],
    contextPassDates:[],
    recallHistoryDates:[],
    contextHistoryDates:[],
    stabilityDays:clamp((Number(value.step)||0)+1,.25,30),
    difficulty:clamp(5+(Number(value.errors)||0)*.35,1,10),
    lapses:Math.max(0,Number(value.errors)||0),
    cycleStartedAt:0,
    legacyQualified,
    tailStage:false,
    level:seen?2:0
  };
}

export function memoryStage(value={}){
  const record=upgradeMemoryRecord(value);
  if(record.slain)return'slain';
  if(record.needsRelearning)return'relearning';
  if(record.recallPassDates.length>=2&&record.contextPassDates.length>=1)return'mastered';
  if(record.recallPassDates.length>=2)return'context';
  if(record.recallPassDates.length>=1)return'recall';
  if(record.recognitionCount>0)return'recognition';
  return'new';
}

export function memoryLabel(value={}){
  const record=upgradeMemoryRecord(value),stage=memoryStage(record);
  if(record.legacyQualified&&stage==='recognition')return'旧掌握 · 待主动验证';
  if(stage==='recall')return`能想起 · 跨日 ${record.recallPassDates.length}/2`;
  return STAGES[stage]?.label||'学习中';
}

export function questionTypeForRecord(value={},options={}){
  const record=upgradeMemoryRecord(value),stage=memoryStage(record);
  if(options.reviewOnly)return'recognition';
  // 旧版的“连续答对三次/四级掌握”只有选择题证据，升级后必须先做一次
  // 无提示回忆，避免把排除选项形成的熟悉感继续当成真实掌握。
  if(record.legacyQualified&&stage==='recognition')return'recall';
  if(stage==='new')return'acquisition';
  if(stage==='recognition'||stage==='relearning')return'recall';
  if(stage==='recall')return'recall';
  if(stage==='context')return options.hasContext===false?'recall':'context';
  if(stage==='mastered')return(Number(record.masteredReviewCount)||0)%3===2&&options.hasContext!==false?'context':'recall';
  return'recognition';
}

function successfulStability(record,kind,elapsedDays){
  const difficultyFactor=clamp((11-record.difficulty)/6,.35,1.65);
  const spacingBonus=clamp(1+Math.log1p(Math.max(0,elapsedDays))/5,1,1.75);
  const kindFactor=kind==='recall'?1.9:kind==='context'?1.65:1.2;
  return clamp(Math.max(1,record.stabilityDays)*kindFactor*difficultyFactor*spacingBonus,.5,3650);
}

function intervalFor(record,kind){
  const stage=memoryStage(record);
  if(stage==='recognition')return 1;
  if(stage==='recall')return Math.max(3,Math.round(record.stabilityDays));
  if(stage==='context')return Math.max(7,Math.round(record.stabilityDays));
  if(stage==='mastered')return Math.max(15,Math.round(record.stabilityDays));
  if(kind==='recognition')return 1;
  return Math.max(1,Math.round(record.stabilityDays));
}

export function recordMemoryAnswer(value={},answer={}){
  const record=upgradeMemoryRecord(value),at=Number(answer.at)||Date.now(),date=String(answer.date||new Date(at).toISOString().slice(0,10)),kind=['acquisition','recognition','recall','context'].includes(answer.kind)?answer.kind:'recognition',correct=Boolean(answer.correct),lastAt=Number(record.lastSeen)||0,elapsedDays=lastAt?Math.max(0,(at-lastAt)/DAY):0;
  let next={...record,lastSeen:at,lastReviewAt:at,lastQuestionType:kind,drawn:true};
  if(kind==='acquisition'){
    next.exposureDates=uniqueDates([...record.exposureDates,date]);
    next.lastAcquisitionAt=at;
    next.correctStreak=correct?Math.min((record.correctStreak||0)+1,99):0;
    next.recognitionCount=Math.max(1,record.recognitionCount||0);
    next.acquisitionSuccessCount=(record.acquisitionSuccessCount||0)+(correct?1:0);
    next.acquisitionMisses=(record.acquisitionMisses||0)+(correct?0:1);
    next.needsRelearning=!correct;
    next.lastPassedAt=correct?at:record.lastPassedAt;
    next.lastFailedAt=correct?record.lastFailedAt:at;
    next.level=correct?2:1;
    next.tailStage=false;
    next.difficulty=clamp(record.difficulty+(correct?-.08:.18),1,10);
    next.due=correct?at+DAY:at+10*MINUTE;
    return next;
  }
  if(!correct){
    next={
      ...next,
      errors:(record.errors||0)+1,
      lapses:(record.lapses||0)+1,
      correctStreak:0,
      needsRelearning:true,
      lastFailedAt:at,
      cycleStartedAt:at,
      recallHistoryDates:archiveDates(record.recallHistoryDates,record.recallPassDates),
      contextHistoryDates:archiveDates(record.contextHistoryDates,record.contextPassDates),
      recallPassDates:[],
      contextPassDates:[],
      masteredAt:null,
      masteredReviewCount:0,
      stabilityDays:clamp(record.stabilityDays*.45,.25,3650),
      difficulty:clamp(record.difficulty+.8,1,10),
      level:1,
      tailStage:false,
      due:at+10*MINUTE
    };
    return next;
  }
  next.correctStreak=Math.min((record.correctStreak||0)+1,99);
  next.needsRelearning=false;
  next.lastPassedAt=at;
  next.difficulty=clamp(record.difficulty-.18,1,10);
  next.stabilityDays=successfulStability(record,kind,elapsedDays);
  if(kind==='recognition')next.recognitionCount=(record.recognitionCount||0)+1;
  if(kind==='recall')next.recallPassDates=uniqueDates([...record.recallPassDates,date]);
  if(kind==='context')next.contextPassDates=uniqueDates([...record.contextPassDates,date]);
  const stage=memoryStage(next);
  next.level=STAGES[stage]?.level||2;
  next.tailStage=stage==='mastered';
  if(stage==='mastered'){
    next.masteredAt=next.masteredAt||at;
    next.masteredReviewCount=(record.masteredReviewCount||0)+1;
    next.legacyQualified=false;
  }
  next.due=at+intervalFor(next,kind)*DAY;
  return next;
}

export function memorySummary(records={}){
  const summary={new:0,recognition:0,recall:0,context:0,mastered:0,relearning:0,slain:0};
  for(const record of Object.values(records||{}))summary[memoryStage(record)]++;
  return summary;
}
