export function todayQuizCandidates(pool={},records={},today=''){
  const completed=new Set(pool.completed||[]),seen=new Set(),items=[];
  for(const word of pool.items||[]){
    const record=records[word]||{};
    if(!word||seen.has(word)||record.slain)continue;
    if(completed.has(word)||record.todayDoneDate===today){seen.add(word);items.push(word)}
  }
  return items;
}
