const normalizeText=value=>String(value||'').replace(/\s+/g,' ').trim();

function optionKey(item){
  return normalizeText(item?.word).toLowerCase();
}

function translationKey(item){
  return normalizeText(item?.translation).toLowerCase();
}

function addDistractors(target,picked,seenWords,seenTranslations,items){
  for(const item of items||[]){
    if(picked.length>=target)break;
    const wordKey=optionKey(item),meaningKey=translationKey(item);
    if(!item||!wordKey||!meaningKey)continue;
    if(seenWords.has(wordKey)||seenTranslations.has(meaningKey))continue;
    seenWords.add(wordKey);
    seenTranslations.add(meaningKey);
    picked.push(item);
  }
}

export function shuffleOptions(items,random=Math.random){
  const a=[...items];
  for(let i=a.length-1;i;i--){
    const j=Math.floor(random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

export function buildChoiceOptions(answer,preferredGroups=[],fallbackItems=[],limit=4,random=Math.random){
  const picked=[];
  const seenWords=new Set([optionKey(answer)].filter(Boolean));
  const seenTranslations=new Set([translationKey(answer)].filter(Boolean));
  const target=Math.max(0,limit-1);
  for(const group of preferredGroups){
    addDistractors(target,picked,seenWords,seenTranslations,group);
  }
  addDistractors(target,picked,seenWords,seenTranslations,fallbackItems);
  return shuffleOptions([answer,...picked],random);
}
