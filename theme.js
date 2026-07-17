const themes={warm:{bg:'#f5f1e8',paper:'#fffdf7',ink:'#1d2921',muted:'#68736b',line:'#d8d5ca',accent:'#e2774f',soft:'#eef0e8'},day:{bg:'#f4f7fb',paper:'#ffffff',ink:'#17212b',muted:'#637080',line:'#d9e0e8',accent:'#2d6cdf',soft:'#edf3fa'},dark:{bg:'#141916',paper:'#1d2520',ink:'#edf3ee',muted:'#a6b0a9',line:'#354139',accent:'#ef8d66',soft:'#263129'}};

function applyTheme(name){const t=themes[name]||themes.warm;
Object.entries(t).forEach(([k,v])=>document.documentElement.style.setProperty(`--${k}`,v));
document.documentElement.dataset.theme=name;
document.documentElement.style.colorScheme=name==='dark'?'dark':'light';
localStorage.setItem('ky5_theme',name);
document.querySelector('#themeSelect')?.setAttribute('data-value',name)}
document.head.insertAdjacentHTML('beforeend','<style>[data-theme="dark"] .btn:not(.secondary):not(.danger){background:var(--accent);color:#18120f}[data-theme="dark"] .btn.accent{background:var(--accent);color:#18120f}</style>');
let lastTouchEnd=0;
document.addEventListener('touchend',e=>{
const tag=e.target?.tagName;
if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;
const now=Date.now();
if(now-lastTouchEnd<320)e.preventDefault();
lastTouchEnd=now;
},{passive:false});
document.addEventListener('DOMContentLoaded',()=>{const nav=document.querySelector('.nav');
if(nav){if(!nav.querySelector('[href="lookup.html"]'))nav.insertAdjacentHTML('beforeend','<a href="lookup.html">查词</a><a href="exam.html">真题</a>');
const wrap=document.createElement('label');
wrap.className='theme-control';
wrap.innerHTML='<span>场景</span><select id="themeSelect" class="field"><option value="warm">暖色</option><option value="day">白天</option><option value="dark">深色</option></select>';
document.querySelector('.topbar')?.append(wrap);
const saved=localStorage.getItem('ky5_theme')||'warm';
wrap.querySelector('select').value=saved;
wrap.querySelector('select').onchange=e=>applyTheme(e.target.value)}applyTheme(localStorage.getItem('ky5_theme')||'warm')});
