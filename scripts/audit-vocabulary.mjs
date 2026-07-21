import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['gaokao','kaoyan'];
const wordPattern=/^[a-z]+(?:[-'][a-z]+)*(?:\s+[a-z]+(?:[-'][a-z]+)*)*$/;
const invisiblePattern=/[\u00ad\u200b\ue000-\uf8ff]/;
let failed=false;

for(const name of files){
  const rows=JSON.parse(fs.readFileSync(path.join(root,'data',`${name}.json`),'utf8').replace(/^\uFEFF/,''));
  const seen=new Map(),issues=[];
  rows.forEach((item,index)=>{
    const word=String(item?.word||'').trim().toLowerCase(),translation=String(item?.translation||'').trim();
    if(!wordPattern.test(word))issues.push({index,word,problem:'单词格式异常'});
    if(!translation||translation==='暂无释义')issues.push({index,word,problem:'缺少中文释义'});
    if(invisiblePattern.test(JSON.stringify(item)))issues.push({index,word,problem:'含不可见或私用区字符'});
    seen.set(word,(seen.get(word)||0)+1);
  });
  for(const[word,count]of seen)if(count>1)issues.push({word,problem:`重复 ${count} 次`});
  failed||=issues.length>0;
  console.log(`${name}: ${rows.length} 词，结构问题 ${issues.length} 个`);
  if(issues.length)console.table(issues.slice(0,50));
}

if(failed)process.exitCode=1;
