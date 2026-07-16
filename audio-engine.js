const AUDIO_CACHE_KEY='ky5_pronunciation_cache';
const HUMAN_AUDIO_API='https://api.dictionaryapi.dev/api/v2/entries/en/';
const CACHE_LIMIT=420;
let currentAudio=null,currentUtterance=null,speakToken=0,voicesPromise=null;

const readCache=()=>{try{return JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY)||'{}')}catch{return{}}};
const writeCache=cache=>{try{const entries=Object.entries(cache).slice(-CACHE_LIMIT);localStorage.setItem(AUDIO_CACHE_KEY,JSON.stringify(Object.fromEntries(entries)))}catch{}};
const normalizeText=text=>String(text||'').trim().replace(/\s+/g,' ');
const normalizeWord=text=>normalizeText(text).toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g,'').replace(/'s$/,'');
const isSingleWord=text=>/^[a-z]+(?:[-'][a-z]+)?$/i.test(normalizeText(text));
const accentKey=lang=>String(lang||'en-US').toLowerCase().includes('gb')||String(lang||'').toLowerCase().includes('uk')?'uk':'us';

function stopPlayback(){
  speakToken++;
  if(currentAudio){
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio.load?.();
    currentAudio=null;
  }
  if('speechSynthesis'in window)speechSynthesis.cancel();
  currentUtterance=null;
}

function scoreAudio(item,accent){
  const hay=`${item.audio||''} ${item.text||''} ${item.sourceUrl||''}`.toLowerCase();
  let score=item.audio?1:0;
  if(accent==='us'&&/(^|[^a-z])(us|american|_us_|-us|en-us)([^a-z]|$)/.test(hay))score+=6;
  if(accent==='uk'&&/(^|[^a-z])(uk|gb|british|_gb_|-gb|en-gb)([^a-z]|$)/.test(hay))score+=6;
  if(/\.mp3(\?|$)/.test(hay))score+=2;
  if(/ssl\.gstatic|wikimedia|dictionaryapi/.test(hay))score+=1;
  return score;
}

async function fetchHumanAudio(word,lang){
  const cleaned=normalizeWord(word);
  if(!cleaned)return null;
  const accent=accentKey(lang),key=`${cleaned}:${accent}`,cache=readCache();
  if(Object.prototype.hasOwnProperty.call(cache,key))return cache[key]||null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),3600);
  try{
    const res=await fetch(`${HUMAN_AUDIO_API}${encodeURIComponent(cleaned)}`,{signal:controller.signal,cache:'force-cache'});
    if(!res.ok)throw new Error(`audio api ${res.status}`);
    const data=await res.json();
    const candidates=(Array.isArray(data)?data:[]).flatMap(entry=>entry.phonetics||[]).filter(x=>x?.audio);
    const best=candidates.sort((a,b)=>scoreAudio(b,accent)-scoreAudio(a,accent))[0]?.audio||'';
    cache[key]=best||'';
    writeCache(cache);
    return best||null;
  }catch{
    cache[key]='';
    writeCache(cache);
    return null;
  }finally{
    clearTimeout(timer);
  }
}

function playAudio(url){
  return new Promise((resolve,reject)=>{
    const audio=new Audio(url);
    currentAudio=audio;
    audio.preload='auto';
    audio.onended=()=>{if(currentAudio===audio)currentAudio=null;resolve(true)};
    audio.onerror=()=>{if(currentAudio===audio)currentAudio=null;reject(new Error('audio playback failed'))};
    audio.play().then(()=>{}).catch(error=>{if(currentAudio===audio)currentAudio=null;reject(error)});
  });
}

function voicesReady(){
  if(voicesPromise)return voicesPromise;
  voicesPromise=new Promise(resolve=>{
    if(!('speechSynthesis'in window))return resolve([]);
    const existing=speechSynthesis.getVoices();
    if(existing.length)return resolve(existing);
    const done=()=>resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener?.('voiceschanged',done,{once:true});
    setTimeout(done,700);
  });
  return voicesPromise;
}

function voiceScore(voice,lang){
  const target=String(lang||'en-US').toLowerCase(),vlang=String(voice.lang||'').toLowerCase(),name=String(voice.name||'').toLowerCase();
  let score=0;
  if(vlang===target)score+=8;
  else if(vlang.startsWith(target.slice(0,2)))score+=4;
  if(/samantha|daniel|serena|karen|moira|tessa|alex|ava|allison|susan|tom|jenny|aria|guy|google|microsoft|premium|natural|enhanced/.test(name))score+=5;
  if(/compact|basic|robot|default/.test(name))score-=2;
  if(target.includes('gb')&&/daniel|serena|uk|british|en-gb/.test(`${name} ${vlang}`))score+=4;
  if(target.includes('us')&&/samantha|alex|jenny|aria|us|american|en-us/.test(`${name} ${vlang}`))score+=4;
  return score;
}

async function speakText(text,lang='en-US',options={}){
  const value=normalizeText(text);
  if(!value)return false;
  stopPlayback();
  if(!('speechSynthesis'in window))return false;
  const token=++speakToken;
  const voices=await voicesReady();
  if(token!==speakToken)return false;
  const utterance=new SpeechSynthesisUtterance(value);
  const best=voices.filter(v=>String(v.lang||'').toLowerCase().startsWith('en')).sort((a,b)=>voiceScore(b,lang)-voiceScore(a,lang))[0];
  if(best)utterance.voice=best;
  utterance.lang=lang;
  utterance.rate=options.rate??(value.length>28?0.88:0.82);
  utterance.pitch=1;
  utterance.volume=1;
  currentUtterance=utterance;
  return new Promise(resolve=>{
    utterance.onend=()=>{if(currentUtterance===utterance)currentUtterance=null;resolve(true)};
    utterance.onerror=()=>{if(currentUtterance===utterance)currentUtterance=null;resolve(false)};
    setTimeout(()=>{if(token===speakToken)speechSynthesis.speak(utterance)},40);
  });
}

export async function playPronunciation(text,lang='en-US',options={}){
  const value=normalizeText(text);
  if(!value)return false;
  stopPlayback();
  const token=speakToken;
  if(options.preferHuman!==false&&isSingleWord(value)){
    const url=await fetchHumanAudio(value,lang);
    if(token!==speakToken)return false;
    if(url){
      try{return await playAudio(url)}catch{}
    }
  }
  if(token!==speakToken)return false;
  return speakText(value,lang,options);
}

export{stopPlayback,speakText};
