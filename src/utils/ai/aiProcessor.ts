import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIAnalysisResult,AIAttendanceRecord,AIPenaltyRecord,AIOtherRecord } from './aiTypes';
import { buildAIPrompt } from './aiPrompt';

const MAX_CHUNK_SIZE=100000;
const RETRY_DELAY=55000;

interface WhatsAppMessage{
  text:string;
  index:number;
}

const ATTENDANCE_SIGNAL=/(?:\b(?:in|out|login|logout|arrived|left|present|absent|attendance|half\s*day|hd|permission|perm|leave|wfh|week\s*off|holiday|late)\b|vandh(?:uten|achu|u)|vandhu|kelamb(?:uren|iten|iyachu)|varala|came|going|work\s*from\s*home)/i;

const PENALTY_SIGNAL=/(?:₹|rs\.?|inr|\bfine\b|\bpenalty\b|\bdeduct(?:ed|ion)?\b|\blate\s*coming\b|\babsence\s*(?:fine|penalty)?\b|\bamount\b)/i;

const OTHER_SIGNAL=/(?:\b(?:holiday|meeting|salary|payment|office\s*(?:closed|open)|closed|schedule|shift|announcement|instruction|notice|working|tomorrow|today|leave|permission|wfh|work\s*from\s*home)\b|naalai|naalaikku|meeting|salary|payment|office\s*close|office\s*open)/i;

const TIME_SIGNAL=/\b(?:[01]?\d|2[0-3])[:.][0-5]\d(?:\s*(?:am|pm))?\b/i;

function parseWhatsAppMessages(text:string):WhatsAppMessage[]{
  const lines=text.split(/\r?\n/);
  const messages:WhatsAppMessage[]=[];
  let current='';

  const header=/^\[\d{1,2}\/\d{1,2}\/\d{4},\s*[^\]]+\]\s*/;

  for(const line of lines){
    if(header.test(line)){
      if(current) messages.push({text:current,index:messages.length});
      current=line;
    }else if(current){
      current+=`\n${line}`;
    }
  }

  if(current) messages.push({text:current,index:messages.length});

  if(messages.length) return messages;

  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line,index)=>({text:line,index}));
}

function isCandidate(message:string):boolean{
  return (
    ATTENDANCE_SIGNAL.test(message) ||
    PENALTY_SIGNAL.test(message) ||
    OTHER_SIGNAL.test(message) ||
    TIME_SIGNAL.test(message) ||
    /@\S+/i.test(message)
  );
}

function extractCandidates(messages:WhatsAppMessage[]):string[]{
  const selected=new Set<number>();

  for(const message of messages){
    if(!isCandidate(message.text)) continue;

    selected.add(message.index);

    if(message.index>0){
      selected.add(message.index-1);
    }

    if(message.index<messages.length-1){
      selected.add(message.index+1);
    }
  }

  return [...selected]
    .sort((a,b)=>a-b)
    .map(index=>messages[index]?.text)
    .filter(Boolean);
}

function buildChunks(messages:string[]):string[]{
  const chunks:string[]=[];
  let current:string[]=[];
  let currentLength=0;

  for(const message of messages){
    const length=message.length+2;

    if(current.length&&currentLength+length>MAX_CHUNK_SIZE){
      chunks.push(current.join('\n\n'));
      current=[];
      currentLength=0;
    }

    current.push(message);
    currentLength+=length;
  }

  if(current.length) chunks.push(current.join('\n\n'));

  return chunks;
}

function sleep(ms:number){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function processChunk(
  model:ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  chunk:string,
  chunkIndex:number,
  totalChunks:number
):Promise<AIAnalysisResult>{
  for(let attempt=1;attempt<=3;attempt++){
    try{
      console.log(`AI CHUNK ${chunkIndex}/${totalChunks}: ${chunk.length} chars`);

      const result=await model.generateContent(buildAIPrompt(chunk));
      const response=await result.response;
      const jsonText=response.text().trim();
      const parsed=JSON.parse(jsonText);

      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)){
        throw new Error('AI returned an invalid result.');
      }

      return {
        attendance:Array.isArray(parsed.attendance)?parsed.attendance:[],
        penalties:Array.isArray(parsed.penalties)?parsed.penalties:[],
        other:Array.isArray(parsed.other)?parsed.other:[]
      };
    }catch(error){
      const message=error instanceof Error?error.message:String(error);

      if(
  (message.includes('429')||message.includes('503'))&&
  attempt<3
){
  console.warn(
    `AI CHUNK ${chunkIndex}: Gemini unavailable/rate limited. Waiting ${RETRY_DELAY/1000}s...`
  );
  await sleep(RETRY_DELAY);
  continue;
}

      throw error;
    }
  }

  throw new Error(`AI chunk ${chunkIndex} failed.`);
}

function mergeAttendance(
  records:AIAttendanceRecord[]
):AIAttendanceRecord[]{
  const map=new Map<string,AIAttendanceRecord>();

  for(const record of records){
    const key=`${record.date}|${record.name.trim().toLowerCase()}`;
    const existing=map.get(key);

    if(!existing){
      map.set(key,{...record});
      continue;
    }

    if((existing.checkIn==='-'||!existing.checkIn)&&record.checkIn&&record.checkIn!=='-'){
      existing.checkIn=record.checkIn;
    }

    if((existing.checkOut==='-'||!existing.checkOut)&&record.checkOut&&record.checkOut!=='-'){
      existing.checkOut=record.checkOut;
    }

    if(existing.halfDay==='-'&&record.halfDay==='Yes'){
      existing.halfDay='Yes';
    }

    if(existing.permission==='-'&&record.permission==='Yes'){
      existing.permission='Yes';
    }

    if((!existing.status||existing.status==='-')&&record.status){
      existing.status=record.status;
    }
  }

  return [...map.values()];
}

function mergePenalties(
  records:AIPenaltyRecord[]
):AIPenaltyRecord[]{
  const map=new Map<string,AIPenaltyRecord>();

  for(const record of records){
    const key=[
      record.date,
      record.name.trim().toLowerCase(),
      record.amount,
      record.reason.trim().toLowerCase()
    ].join('|');

    if(!map.has(key)){
      map.set(key,{...record});
    }
  }

  return [...map.values()];
}

function mergeOther(
  records:AIOtherRecord[]
):AIOtherRecord[]{
  const map=new Map<string,AIOtherRecord>();

  for(const record of records){
    const key=[
      record.date,
      record.type.trim().toLowerCase(),
      record.name?.trim().toLowerCase()||'',
      record.details.trim().toLowerCase()
    ].join('|');

    if(!map.has(key)){
      map.set(key,{...record});
    }
  }

  return [...map.values()];
}

export async function processWithAI(
  text:string
):Promise<AIAnalysisResult>{
  if(!text?.trim()){
    throw new Error('Text is required for AI processing.');
  }

  const apiKey=process.env.GEMINI_API_KEY;

  if(!apiKey){
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const genAI=new GoogleGenerativeAI(apiKey);

  const model=genAI.getGenerativeModel({
    model:'gemini-3.6-flash',
    generationConfig:{
      responseMimeType:'application/json'
    }
  });

  console.log(`AI ORIGINAL INPUT: ${text.length} chars`);

  const messages=parseWhatsAppMessages(text);

  console.log(`AI TOTAL MESSAGES: ${messages.length}`);

  const candidates=extractCandidates(messages);

  console.log(`AI CANDIDATE MESSAGES: ${candidates.length}`);

  const candidateText=candidates.join('\n\n');

  console.log(`AI FILTERED INPUT: ${candidateText.length} chars`);

  if(!candidateText.trim()){
    return {
      attendance:[],
      penalties:[],
      other:[]
    };
  }

  const chunks=buildChunks(candidates);

  console.log(`AI TOTAL CHUNKS: ${chunks.length}`);

  const allAttendance:AIAttendanceRecord[]=[];
  const allPenalties:AIPenaltyRecord[]=[];
  const allOther:AIOtherRecord[]=[];

  for(let i=0;i<chunks.length;i++){
    const result=await processChunk(
      model,
      chunks[i],
      i+1,
      chunks.length
    );

    allAttendance.push(...result.attendance);
    allPenalties.push(...result.penalties);
    allOther.push(...result.other);

    console.log(`AI CHUNK ${i+1}/${chunks.length} COMPLETED`);
  }

  const finalResult:AIAnalysisResult={
    attendance:mergeAttendance(allAttendance),
    penalties:mergePenalties(allPenalties),
    other:mergeOther(allOther)
  };

  console.log('AI FINAL RESULT:',{
    attendance:finalResult.attendance.length,
    penalties:finalResult.penalties.length,
    other:finalResult.other.length
  });

  return finalResult;
}