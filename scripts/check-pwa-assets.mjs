import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const match=source.match(/const ASSETS=\[(.*?)\];/s);
if(!match)throw new Error('无法读取 Service Worker 资源清单');
const assets=[...match[1].matchAll(/'([^']+)'/g)].map(item=>item[1]);
const missing=assets.filter(item=>item!=='./'&&!fs.existsSync(path.join(root,item.replace(/^\.\//,''))));
if(missing.length){console.error('PWA 缺少缓存文件：',missing);process.exit(1)}
if(!assets.includes('./memory-engine.js'))throw new Error('memory-engine.js 尚未加入离线缓存');
console.log(`PWA 缓存清单 ${assets.length} 项全部存在，已包含记忆引擎。`);
