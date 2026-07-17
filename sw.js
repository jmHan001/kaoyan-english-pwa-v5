const CACHE='shici-v5.6.19-dedicated-study-page';
const ASSETS=['./','./index.html','./study.html','./styles.css','./memory.css','./enhancements.css','./choices.css','./interactive-english.css','./theme.js','./knowledge.js','./audio-engine.js','./app.js','./study.js','./quiz-options.js','./interactive-english.js','./vocabulary-manager.js','./learning-pool.js','./review-manager.js','./stats.js','./cloud-sync.js','./sync.html','./sync.css','./sync-page.js','./vocabulary.html','./sentence.html','./sentence.js','./sentence-parser.mjs','./reading.html','./reading.js','./lookup.html','./lookup.js','./exam.html','./exam.js','./manifest.webmanifest','./icons/icon.svg','./data/gaokao.json','./data/kaoyan.json','./data/SOURCE.md'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{for(const u of ASSETS){try{const r=await fetch(u,{cache:'reload'});
if(r.ok)await c.put(u,r)}catch{}}}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();
caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
