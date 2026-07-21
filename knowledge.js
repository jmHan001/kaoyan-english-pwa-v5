import{playPronunciation}from'./audio-engine.js?v=6.0.0';

const prefixes={anti:'反、抗',auto:'自己',co:'共同',de:'向下、去除',dis:'否定、分离',inter:'在……之间',mis:'错误',pre:'在前',re:'再次、向后',sub:'在下',trans:'跨越、转变',un:'否定'};
const suffixes={able:'能够……的',al:'形容词或名词后缀',er:'人或物',ful:'充满……的',ify:'使……化',ing:'动作或过程',ion:'动作、状态名词',ist:'从事者',ity:'性质、状态',ive:'具有……性质的',less:'没有……的',ly:'副词后缀',ment:'行为或结果',ness:'性质、状态',ous:'具有……的'};
const synonymGroups=[
  ['abandon','desert','quit','give up'],
  ['ability','capacity','capability','competence','skill'],
  ['abolish','cancel','remove','eliminate'],
  ['abundant','plentiful','ample','rich'],
  ['accept','receive','admit','approve'],
  ['accurate','exact','precise','correct'],
  ['achieve','accomplish','attain','complete'],
  ['adapt','adjust','modify'],
  ['adequate','enough','sufficient'],
  ['advantage','benefit','merit'],
  ['affect','influence','impact'],
  ['aim','goal','purpose','target'],
  ['allow','permit','enable'],
  ['alter','change','modify'],
  ['ancient','old','historic'],
  ['anger','rage','fury'],
  ['annual','yearly'],
  ['apparent','obvious','clear','evident'],
  ['approach','method','way','means'],
  ['argue','debate','dispute'],
  ['assist','help','aid'],
  ['attempt','try','effort'],
  ['available','accessible','obtainable'],
  ['avoid','escape','evade'],
  ['basic','fundamental','essential'],
  ['beautiful','pretty','attractive'],
  ['brief','short','concise'],
  ['calm','quiet','peaceful'],
  ['careful','cautious','attentive'],
  ['cause','reason','factor'],
  ['certain','sure','confident'],
  ['challenge','difficulty','problem'],
  ['chance','opportunity','possibility'],
  ['choose','select','pick'],
  ['common','ordinary','usual'],
  ['complete','finish','accomplish'],
  ['complex','complicated'],
  ['concern','worry','anxiety'],
  ['conduct','behavior','act'],
  ['connect','link','relate'],
  ['consider','think','regard'],
  ['constant','continuous','steady'],
  ['create','produce','generate'],
  ['crucial','important','vital','essential'],
  ['damage','harm','hurt','injure'],
  ['decide','determine','choose'],
  ['decrease','reduce','decline'],
  ['demand','require','need'],
  ['develop','grow','expand'],
  ['difficult','hard','tough'],
  ['discover','find','detect'],
  ['efficient','effective','productive'],
  ['emphasize','stress','highlight'],
  ['encourage','inspire','motivate'],
  ['enormous','huge','vast','immense'],
  ['essential','necessary','vital','crucial'],
  ['establish','build','found','set up'],
  ['evident','obvious','clear','apparent'],
  ['explain','interpret','clarify'],
  ['famous','well-known','noted'],
  ['final','last','ultimate'],
  ['focus','concentrate'],
  ['frequent','common','regular'],
  ['function','role','purpose'],
  ['gradual','slow','progressive'],
  ['harm','damage','hurt'],
  ['important','significant','vital','crucial'],
  ['increase','rise','grow'],
  ['influence','affect','impact'],
  ['likely','probable','possible'],
  ['maintain','keep','preserve'],
  ['major','main','chief'],
  ['method','way','approach','means'],
  ['necessary','essential','needed'],
  ['obtain','get','gain','acquire'],
  ['ordinary','common','usual'],
  ['particular','specific','special'],
  ['prevent','stop','avoid'],
  ['primary','main','chief'],
  ['problem','issue','difficulty'],
  ['provide','offer','supply'],
  ['rapid','fast','quick'],
  ['reason','cause','factor'],
  ['reduce','decrease','lower'],
  ['require','need','demand'],
  ['respond','reply','answer'],
  ['result','outcome','effect'],
  ['significant','important','meaningful'],
  ['similar','alike'],
  ['simple','easy','plain'],
  ['solve','settle','resolve'],
  ['strange','odd','unusual'],
  ['support','back','assist'],
  ['therefore','thus','hence'],
  ['various','different','diverse']
];
const stopWords=new Set(['人名','名词','动词','形容词','副词','介词','连词','代词','缩写','表示','用于','东西','事情','一种','一个','某人','某事','进行','使','有','的','地','得']);
const translationOverrides={
  rich:'adj. 富有的；丰富的；肥沃的；油腻的；n. 富人',
  abundant:'adj. 丰富的；充裕的；大量的',
  ample:'adj. 足够的；充裕的；宽敞的',
  plentiful:'adj. 丰富的；充足的；大量的',
  wealthy:'adj. 富有的；富裕的；n. 富人'
};

export function cleanTranslation(wordOrItem,text){
  const word=cleanWord(typeof wordOrItem==='string'?wordOrItem:wordOrItem?.word);
  if(translationOverrides[word])return translationOverrides[word];
  return String((text??(typeof wordOrItem==='object'?wordOrItem?.translation:''))||'暂无释义')
    .replace(/\s+/g,' ')
    .replace(/；?\s*n\.\s*[（(][^）)]*[）)][^；;]*/g,'')
    .replace(/；?\s*[（(][^）)]*人名[^）)]*[）)]/g,'')
    .replace(/；?\s*人名[^；;]*/g,'')
    .replace(/；{2,}/g,'；')
    .replace(/^；|；$/g,'')
    .trim()||'暂无释义';
}

export function coreTranslation(wordOrItem,text,limit=3){
  const source=cleanTranslation(wordOrItem,text),parts=source.split(/[；;]/).map(x=>x.trim()).filter(Boolean),groups=[],priority={v:0,adj:1,n:2,adv:3,prep:4,conj:5,pron:6,num:7,abbr:8};
  let current='';
  for(const part of parts){const match=part.match(/^([a-z]+)\.\s*(.*)$/i);if(match)current=match[1].toLowerCase();groups.push({pos:current,text:match?match[2]:part})}
  const chosen=groups.map((item,index)=>({...item,index,rank:priority[item.pos]??9})).sort((a,b)=>a.rank-b.rank||a.index-b.index).slice(0,limit);
  let last='';
  return chosen.map(item=>{const prefix=item.pos&&item.pos!==last?`${item.pos}. `:'';last=item.pos;return`${prefix}${item.text}`}).join('；')||source;
}

function normalizeMeaning(value){
  return String(value||'').toLowerCase()
    .replace(/[a-z]+\./g,'')
    .replace(/[（(][^）)]*[）)]/g,'')
    .replace(/[^\u3400-\u9fffa-z0-9]+/g,'')
    .replace(/^(表示|指|意为|意思是)/,'')
    .replace(/[的地得]$/,'')
    .trim();
}

export function acceptedMeanings(wordOrItem,text,limit=16){
  const source=cleanTranslation(wordOrItem,text),out=[],seen=new Set();
  for(const raw of source.replace(/([a-z]+\.)/gi,'；$1 ').split(/[；;，,、/]/)){
    const display=String(raw||'').replace(/^[a-z]+\.\s*/i,'').replace(/[（(][^）)]*[）)]/g,'').trim();
    const normalized=normalizeMeaning(display);
    if(!display||!normalized||seen.has(normalized)||stopWords.has(normalized))continue;
    if(normalized.length===1&&['有','使','做','是','在','到','为'].includes(normalized))continue;
    seen.add(normalized);out.push({display,normalized});
    if(out.length>=limit)break;
  }
  return out;
}

export function matchCoreMeaning(input,wordOrItem,text){
  const entered=String(input||'').split(/[；;，,、/\s]+/).map(normalizeMeaning).filter(Boolean);
  if(!entered.length)return{correct:false,accepted:acceptedMeanings(wordOrItem,text).map(x=>x.display)};
  const accepted=acceptedMeanings(wordOrItem,text),correct=entered.some(value=>accepted.some(item=>value===item.normalized||(value.length>=2&&item.normalized.length>=2&&(item.normalized.includes(value)||value.includes(item.normalized)))));
  return{correct,accepted:accepted.map(x=>x.display),matched:correct?entered.find(value=>accepted.some(item=>value===item.normalized||(value.length>=2&&item.normalized.length>=2&&(item.normalized.includes(value)||value.includes(item.normalized))))):''};
}

export function rootHint(word){
  const w=word.toLowerCase(),hits=[];
  for(const[p,m]of Object.entries(prefixes))if(w.startsWith(p)&&w.length>p.length+3){hits.push(`${p}-：${m}`);break}
  for(const[s,m]of Object.entries(suffixes))if(w.endsWith(s)&&w.length>s.length+3){hits.push(`-${s}：${m}`);break}
  return hits.join('；')||'建议按音节和例句整体记忆，不强拆词根。'
}

export function keyPoint(word){
  const parts=coreTranslation(word).split('；').filter(Boolean);
  return parts.slice(0,3).map((x,i)=>i===0?`<strong><u>${x}</u></strong>`:`<strong>${x}</strong>`).join('；')
}

function cleanWord(value){return String(value||'').toLowerCase().trim()}
function primarySense(text){
  return String(text||'')
    .replace(/[a-z.\[\]（）()]/gi,'')
    .split(/[；;，,、]/)
    .map(x=>x.replace(/^[\s·:：]+|[\s·:：]+$/g,'').replace(/^(的|地|得)/,''))
    .find(x=>x&&x.length>=2&&!stopWords.has(x))||'';
}
function senseTokens(text){
  return String(text||'')
    .replace(/[a-z.\[\]（）()]/gi,'')
    .split(/[；;，,、\s]/)
    .map(x=>x.trim())
    .filter(x=>x.length>=2&&!stopWords.has(x)&&!/^[一-龥]名$/.test(x));
}
function groupMatches(word,candidate){
  const w=cleanWord(word),c=cleanWord(candidate);
  return synonymGroups.some(group=>group.includes(w)&&group.includes(c));
}

export function nearWords(word,all){
  if(!word?.word)return[];
  const w=cleanWord(word.word),main=primarySense(cleanTranslation(word)),tokens=senseTokens(cleanTranslation(word));
  const scored=[];
  for(const item of all){
    if(item.word===word.word)continue;
    const candidate=cleanWord(item.word);
    let score=0,reason='';
    if(groupMatches(w,candidate)){score+=9;reason='常见近义词组'}
    const candidateMain=primarySense(cleanTranslation(item));
    if(main&&candidateMain&&main===candidateMain){score+=5;reason=reason||`核心义同为“${main}”`}
    const overlap=tokens.filter(t=>senseTokens(cleanTranslation(item)).includes(t));
    if(overlap.length&&tokens.length<=5){score+=Math.min(2,overlap.length);reason=reason||`释义相关：${overlap.slice(0,2).join('、')}`}
    if(score>=5)scored.push({...item,relatedReason:reason,relatedScore:score});
  }
  return scored.sort((a,b)=>b.relatedScore-a.relatedScore||a.word.localeCompare(b.word)).slice(0,6);
}

export function speak(text,lang='en-US'){return playPronunciation(text,lang)}
