const themes={
warm:{bg:'#fbfaf8',paper:'#fffefd',ink:'#0b1a42',muted:'#77798a',line:'#e8e4e1',accent:'#655fd7','accent-strong':'#514bc4',soft:'#f3f1fb'},
day:{bg:'#f6f7fb',paper:'#ffffff',ink:'#14213d',muted:'#72798a',line:'#e0e4ec',accent:'#526ebf','accent-strong':'#405ca9',soft:'#edf1f9'},
dark:{bg:'#111025',paper:'#1a1935',ink:'#f4f0ea',muted:'#aaa6bd',line:'#343151',accent:'#9a90ff','accent-strong':'#8277ec',soft:'#242144'}
};
const THEME_VERSION='6.0.0';
if(!localStorage.getItem('ky5_theme'))localStorage.setItem('ky5_theme','warm');
localStorage.setItem('ky5_theme_version',THEME_VERSION);

function applyTheme(name){const t=themes[name]||themes.warm;
Object.entries(t).forEach(([k,v])=>document.documentElement.style.setProperty(`--${k}`,v));
document.documentElement.dataset.theme=name;
document.documentElement.style.colorScheme=name==='dark'?'dark':'light';
localStorage.setItem('ky5_theme',name);
document.querySelector('#themeSelect')?.setAttribute('data-value',name)}
document.head.insertAdjacentHTML('beforeend','<style>[data-theme="dark"] .btn:not(.secondary):not(.danger){background:var(--accent);color:#111025}[data-theme="dark"] .btn.accent{background:var(--accent);color:#111025}</style>');
document.addEventListener('DOMContentLoaded',()=>{const nav=document.querySelector('.nav');
if(nav){if(!nav.querySelector('[href="lookup.html"]'))nav.insertAdjacentHTML('beforeend','<a href="lookup.html">查词</a><a href="exam.html">真题</a>');
const wrap=document.createElement('label');
wrap.className='theme-control';
wrap.innerHTML='<span>主题</span><select id="themeSelect" class="field"><option value="warm">珍珠白</option><option value="day">柔光蓝</option><option value="dark">夜读紫</option></select>';
document.querySelector('.topbar')?.append(wrap);
const saved=localStorage.getItem('ky5_theme')||'warm';
wrap.querySelector('select').value=saved;
wrap.querySelector('select').onchange=e=>applyTheme(e.target.value)}applyTheme(localStorage.getItem('ky5_theme')||'warm')});
