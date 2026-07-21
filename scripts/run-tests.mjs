import fs from'node:fs';
import path from'node:path';
import{spawnSync}from'node:child_process';
import{fileURLToPath}from'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=fs.readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.mjs')).sort();
for(const test of tests){
  const result=spawnSync(process.execPath,[path.join(root,'tests',test)],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`全部 ${tests.length} 个测试文件通过`);
