export type StructuredColumnType='Number'|'Text'|'Date'|'Boolean'|'Empty';

export interface ValueFrequency {
  value:string;
  count:number;
}

export interface StructuredColumnAnalytics {
  key:string;
  type:StructuredColumnType;
  totalRows:number;
  filledRows:number;
  missingRows:number;
  uniqueValues:number;
  duplicateValues:number;
  numeric?:{
    sum:number;
    min:number;
    max:number;
    average:number;
    median:number;
    zeroCount:number;
  };
  topValues?:ValueFrequency[];
  date?:{
    earliest:string;
    latest:string;
    rangeDays:number;
  };
}

export interface StructuredAnalytics {
  totalRows:number;
  totalColumns:number;
  emptyRows:number;
  duplicateRows:number;
  columns:StructuredColumnAnalytics[];
}

function isMissing(value:unknown):boolean{
  return value===null||value===undefined||(typeof value==='string'&&value.trim()==='');
}

function toNumber(value:unknown):number|null{
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value!=='string'||value.trim()==='')return null;
  const normalized=value.replace(/[,₹$€£%]/g,'').trim();
  const number=Number(normalized);
  return Number.isFinite(number)?number:null;
}

function toDate(value:unknown):Date|null{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value;
  if(typeof value!=='string'&&typeof value!=='number')return null;
  const text=String(value).trim();
  if(!text)return null;
  const match=text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if(match){
    const day=Number(match[1]);
    const month=Number(match[2])-1;
    const year=Number(match[3]);
    const date=new Date(year,month,day);
    if(date.getFullYear()===year&&date.getMonth()===month&&date.getDate()===day)return date;
    return null;
  }
  const date=new Date(text);
  return Number.isNaN(date.getTime())?null:date;
}

function formatDate(date:Date):string{
  return date.toISOString().slice(0,10);
}

function median(values:number[]):number{
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2===0?(sorted[middle-1]+sorted[middle])/2:sorted[middle];
}

function detectColumnType(values:unknown[]):StructuredColumnType{
  const nonMissing=values.filter(value=>!isMissing(value));
  if(!nonMissing.length)return 'Empty';
  if(nonMissing.every(value=>typeof value==='boolean'))return 'Boolean';
  if(nonMissing.every(value=>toNumber(value)!==null))return 'Number';
  if(nonMissing.every(value=>toDate(value)!==null))return 'Date';
  return 'Text';
}

function normalizedValue(value:unknown):string{
  if(value===null||value===undefined)return '';
  if(value instanceof Date)return value.toISOString();
  if(typeof value==='object'){
    try{return JSON.stringify(value);}
    catch{return String(value);}
  }
  return String(value).trim();
}

function rowKey(row:Record<string,any>,keys:string[]):string{
  return JSON.stringify(keys.map(key=>normalizedValue(row[key])));
}

export function analyzeStructuredData(data:Record<string,any>[]):StructuredAnalytics{
  const rows=Array.isArray(data)?data.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)):[];
  if(!rows.length)return{totalRows:0,totalColumns:0,emptyRows:0,duplicateRows:0,columns:[]};

  const keySet=new Set<string>();
  rows.forEach(row=>Object.keys(row).forEach(key=>keySet.add(key)));
  const keys=Array.from(keySet);

  const rowCounts=new Map<string,number>();
  rows.forEach(row=>{
    const key=rowKey(row,keys);
    rowCounts.set(key,(rowCounts.get(key)||0)+1);
  });
  const duplicateRows=Array.from(rowCounts.values()).reduce((total,count)=>total+(count>1?count-1:0),0);

  const columns=keys.map(key=>{
    const values=rows.map(row=>row[key]);
    const filledValues=values.filter(value=>!isMissing(value));
    const type=detectColumnType(values);
    const normalized=filledValues.map(normalizedValue);
    const uniqueValues=new Set(normalized).size;
    const duplicateValues=Math.max(0,filledValues.length-uniqueValues);
    const result:StructuredColumnAnalytics={
      key,
      type,
      totalRows:rows.length,
      filledRows:filledValues.length,
      missingRows:rows.length-filledValues.length,
      uniqueValues,
      duplicateValues,
    };

    if(type==='Number'){
      const numbers=filledValues.map(toNumber).filter((value):value is number=>value!==null);
      const sum=numbers.reduce((total,value)=>total+value,0);
      result.numeric={
        sum,
        min:numbers.length?Math.min(...numbers):0,
        max:numbers.length?Math.max(...numbers):0,
        average:numbers.length?sum/numbers.length:0,
        median:median(numbers),
        zeroCount:numbers.filter(value=>value===0).length,
      };
    }else if(type==='Text'||type==='Boolean'){
      const frequencies=new Map<string,number>();
      normalized.forEach(value=>frequencies.set(value,(frequencies.get(value)||0)+1));
      result.topValues=Array.from(frequencies.entries())
        .map(([value,count])=>({value,count}))
        .sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value))
        .slice(0,10);
    }else if(type==='Date'){
      const dates=filledValues.map(toDate).filter((value):value is Date=>value!==null).sort((a,b)=>a.getTime()-b.getTime());
      if(dates.length){
        result.date={
          earliest:formatDate(dates[0]),
          latest:formatDate(dates[dates.length-1]),
          rangeDays:Math.round((dates[dates.length-1].getTime()-dates[0].getTime())/86400000),
        };
      }
    }
    return result;
  });

  const emptyRows=rows.filter(row=>keys.every(key=>isMissing(row[key]))).length;
  return{totalRows:rows.length,totalColumns:keys.length,emptyRows,duplicateRows,columns};
}
