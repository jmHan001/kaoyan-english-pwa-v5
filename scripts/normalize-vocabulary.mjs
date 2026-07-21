import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';

const write=process.argv.includes('--write');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['gaokao','kaoyan'];

function sanitize(value){
  if(typeof value==='string')return value.replace(/[\u00ad\u200b\ue000-\uf8ff]/g,'');
  if(Array.isArray(value))return value.map(sanitize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,sanitize(item)]));
  return value;
}

function normalizeWord(value){
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[.]+$/,'').replace(/’/g,"'").replace(/\s+/g,' ');
}

function mergeFirst(first,later){
  const merged={...later,...first};
  for(const key of['translation','us','uk','sentences','phrases'])if(!merged[key]&&later?.[key])merged[key]=later[key];
  return merged;
}

for(const name of files){
  const file=path.join(root,'data',`${name}.json`),raw=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''),rows=JSON.parse(raw),map=new Map();
  for(const source of rows){
    const item=sanitize(source),word=normalizeWord(item?.word);
    if(!word)continue;
    item.word=word;
    map.set(word,map.has(word)?mergeFirst(map.get(word),item):item);
  }
  const normalized=[...map.values()];
  console.log(`${name}: ${rows.length} -> ${normalized.length}，移除重复或空条目 ${rows.length-normalized.length}`);
  if(write)fs.writeFileSync(file,`${JSON.stringify(normalized)}\n`,'utf8');
}

if(!write)console.log('当前为预览；确认后添加 --write 写入。');
