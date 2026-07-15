export const FIELD_MAP={
  '句子编号':'sentenceNumber',
  '来源':'source',
  '原句':'originalSentence',
  '阅读顺序':'readingOrder',
  '意群切分':'chunks',
  '句子主干':'mainClause',
  '句子结构':'structureAnalysis',
  '核心词汇':'vocabulary',
  '参考翻译':'translation',
  '语法笔记':'grammarNotes',
  '固定搭配':'fixedExpressions',
  '个人易错点':'userMistakes',
  '毕业测试':'testResult',
  '掌握状态':'masteryStatus'
};

// Keep the array in classroom-learning order. The parser itself remains
// order-independent, so older clipboard content is still accepted.
export const FIELD_KEYS=Object.values(FIELD_MAP);

const BLOCK_TITLE='网页长难句资料';
const FIELD_PATTERN=/^【([^】]+)】\s*$/;
const QUOTE_MAP={
  '“':'"',
  '”':'"',
  '‘':"'",
  '’':"'",
  '＂':'"',
  '＇':"'",
  '，':',',
  '。':'.',
  '；':';',
  '：':':',
  '？':'?',
  '！':'!'
};

export function normalizeSentence(value=''){
  return String(value)
    .replace(/[“”‘’＂＇，。；：？！]/g,c=>QUOTE_MAP[c]||c)
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

export function defaultSentenceRecord(){
  return FIELD_KEYS.reduce((out,key)=>({...out,[key]:''}),{unrecognized:''});
}

function extractBlock(text){
  const source=String(text||'').replace(/\r\n?/g,'\n');
  const marker=`【${BLOCK_TITLE}】`;
  const start=source.indexOf(marker);
  if(start<0)return{found:false,block:'',before:source,after:''};
  const rest=source.slice(start+marker.length);
  const next=rest.search(/\n【[^】]+】\s*\n?网页长难句资料/);
  return{found:true,block:next>=0?rest.slice(0,next):rest,before:source.slice(0,start),after:next>=0?rest.slice(next):''};
}

function parseFields(block){
  const lines=String(block||'').split('\n');
  const fields=[];
  let current=null;
  const preface=[];
  const pushCurrent=()=>{
    if(current)fields.push({...current,value:current.lines.join('\n').trim()});
  };
  for(const line of lines){
    const match=line.trim().match(FIELD_PATTERN);
    if(match){
      pushCurrent();
      current={name:match[1].trim(),lines:[]};
    }else if(current){
      current.lines.push(line);
    }else if(line.trim()){
      preface.push(line);
    }
  }
  pushCurrent();
  return{fields,preface:preface.join('\n').trim()};
}

export function parseStructuredSentenceMaterial(text){
  const result={
    ok:false,
    errors:[],
    warnings:[],
    foundBlock:false,
    record:defaultSentenceRecord(),
    rawBlock:'',
    unknownFields:{},
    duplicateKey:''
  };
  if(!String(text||'').trim()){
    result.errors.push('剪贴板为空。');
    return result;
  }
  const extracted=extractBlock(text);
  result.foundBlock=extracted.found;
  if(!extracted.found){
    result.errors.push('未找到【网页长难句资料】区块。');
    result.record.unrecognized=String(text||'').trim();
    return result;
  }
  result.rawBlock=extracted.block.trim();
  const parsedBlock=parseFields(extracted.block);
  const fields=parsedBlock.fields;
  if(!fields.length)result.warnings.push('找到了资料区块，但没有识别到字段。');
  const recognizedRanges=new Set();
  for(const field of fields){
    const key=FIELD_MAP[field.name];
    if(key){
      result.record[key]=field.value;
      recognizedRanges.add(field.name);
    }else if(field.name!==BLOCK_TITLE){
      result.unknownFields[field.name]=field.value;
    }
  }
  const fieldText=fields.map(x=>`【${x.name}】\n${x.value}`.trim()).join('\n\n');
  const leftovers=[];
  if(extracted.before.trim())leftovers.push(extracted.before.trim());
  if(parsedBlock.preface)leftovers.push(parsedBlock.preface);
  if(extracted.after.trim())leftovers.push(extracted.after.trim());
  for(const[name,value]of Object.entries(result.unknownFields))leftovers.push(`【${name}】\n${value}`.trim());
  const blockWithoutKnown=result.rawBlock.replace(fieldText,'').trim();
  if(blockWithoutKnown&&!fields.length)leftovers.push(blockWithoutKnown);
  result.record.unrecognized=leftovers.filter(Boolean).join('\n\n');
  if(!result.record.originalSentence)result.warnings.push('缺少【原句】字段。');
  if(!result.record.sentenceNumber)result.warnings.push('缺少【句子编号】字段。');
  result.duplicateKey=normalizeSentence(result.record.originalSentence);
  result.ok=true;
  return result;
}

export function findDuplicateSentence(records=[],originalSentence=''){
  const key=normalizeSentence(originalSentence);
  if(!key)return null;
  return records.find(item=>normalizeSentence(item.originalSentence||item.sentence)===key)||null;
}
