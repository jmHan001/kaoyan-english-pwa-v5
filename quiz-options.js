const normalizeText=value=>String(value||'').replace(/\s+/g,' ').trim();

function optionKey(item){
  return normalizeText(item?.word).toLowerCase();
}

function translationKey(item){
  return normalizeText(item?.translation).toLowerCase();
}

function addDistractors(target,picked,seenWords,seenTranslations,items,blockedWords=new Set()){
  for(const item of items||[]){
    if(picked.length>=target)break;
    const wordKey=optionKey(item),meaningKey=translationKey(item);
    if(!item||!wordKey||!meaningKey)continue;
    if(blockedWords.has(wordKey))continue;
    if(seenWords.has(wordKey)||seenTranslations.has(meaningKey))continue;
    seenWords.add(wordKey);
    seenTranslations.add(meaningKey);
    picked.push(item);
  }
}

export function shuffleOptions(items,random=Math.random){
  return Array.from(items||[]).sort(()=>random()-.5);
}

function sampledOptions(items,random=Math.random,limit=96){
  const length=Number(items?.length)||0,target=Math.min(length,limit),picked=[],seen=new Set();
  for(let attempts=0;picked.length<target&&attempts<target*2;attempts++){
    const index=Math.floor(random()*length);
    if(!seen.has(index)){seen.add(index);picked.push(items[index])}
  }
  for(let index=0;picked.length<target&&index<length;index++)if(!seen.has(index)){seen.add(index);picked.push(items[index])}
  return shuffleOptions(picked,random);
}

function blockedSet(words){
  return new Set((words||[]).map(word=>normalizeText(word).toLowerCase()).filter(Boolean));
}

export function buildChoiceOptions(answer,preferredGroups=[],fallbackItems=[],limit=4,random=Math.random,recentWords=[]){
  const picked=[];
  const seenWords=new Set([optionKey(answer)].filter(Boolean));
  const seenTranslations=new Set([translationKey(answer)].filter(Boolean));
  const target=Math.max(0,limit-1);
  const blocked=blockedSet(recentWords);
  const groups=preferredGroups.map(group=>sampledOptions(group||[],random,48));
  const fallback=sampledOptions(fallbackItems||[],random,128);
  for(const group of groups){
    addDistractors(target,picked,seenWords,seenTranslations,group,blocked);
  }
  addDistractors(target,picked,seenWords,seenTranslations,fallback,blocked);
  if(picked.length<target){
    for(const group of groups){
      addDistractors(target,picked,seenWords,seenTranslations,group);
    }
    addDistractors(target,picked,seenWords,seenTranslations,fallback);
  }
  return shuffleOptions([answer,...picked],random);
}
