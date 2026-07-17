const STARTER_CORE=new Set(`
ability able accept access account achieve act action active activity add advantage affect agree allow amount analysis answer appear approach area argue assume attention available avoid base basic become behavior believe benefit build business cause change choice choose clear common compare complete concern condition consider continue control cost create culture current decide decision decline demand describe develop difference difficult effect effort either enough especially establish evidence example exist expect experience explain fact feature final focus force form general generate government grow happen health help important improve include increase individual industry information interest involve issue knowledge language large lead learn level likely limit maintain major matter mean measure method model modern necessary offer opportunity order organization particular people percent period policy possible practice present pressure problem process produce product provide public question reason receive reduce relation remain require research result role service show significant similar simple social source specific state structure study support system term theory therefore understand value various view within work world
`.trim().split(/\s+/));

export function coreRank(word){
  const key=String(word?.word||word||'').toLowerCase();
  if(STARTER_CORE.has(key))return 0;
  if(word?.source==='both')return 1;
  if(word?.source==='gaokao')return 2;
  return 3;
}

export function isStarterCore(word){return coreRank(word)===0}

function shuffle(items,random=Math.random){
  const out=[];
  for(let i=0;i<(items?.length||0);i++)out.push(items[i]);
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out;
}

export function coreFirst(items,random=Math.random){
  const tiers=[[],[],[],[]];
  for(const item of items||[])tiers[coreRank(item)].push(item);
  return tiers.flatMap(tier=>shuffle(tier,random));
}
