import {
  AttendanceRecord,
  sortByName,
  timeToMinutes,
  convertRawDateToISO,
} from './attendanceUtils';
import { PenaltyRecord } from './penaltyParser';

export interface NameWiseReport extends AttendanceRecord {
  date:string;
}

export interface SummaryRecord {
  name:string;
  count1:number;
  count2:number;
  count3:number;
  total:number;
}

export interface TimeZone {
  start:string;
  end:string;
}

/*
 * --------------------------------------------------
 * NAME WISE REPORT
 * --------------------------------------------------
 */

export function generateNameWiseReport(
  attendanceData:AttendanceRecord[],
  selectedName:string
):NameWiseReport[] {
  if(!selectedName||attendanceData.length===0) return [];

  const normalizedName=selectedName.trim().toLowerCase();

  return attendanceData
    .filter(record=>record.name.trim().toLowerCase()===normalizedName)
    .map(record=>({
      ...record,
      date:record.date||'',
    }))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}

/*
 * --------------------------------------------------
 * DATE WISE REPORT
 * --------------------------------------------------
 */

export function generateDateWiseReport(
  attendanceData: AttendanceRecord[],
  selectedDate: string
): AttendanceRecord[] {
  if (!selectedDate || attendanceData.length === 0) {
    return [];
  }

  const selectedDateISO =
    convertRawDateToISO(selectedDate);

  if (!selectedDateISO) {
    return [];
  }

  return attendanceData
    .filter(
      record =>
        convertRawDateToISO(record.date || '') ===
        selectedDateISO
    )
    .sort(sortByName);
}

/*
 * --------------------------------------------------
 * PENALTY REPORT
 * --------------------------------------------------
 */

export function generatePenaltyReport(
  penaltyData:PenaltyRecord[]
):PenaltyRecord[] {
  if(!penaltyData.length) return [];
  return penaltyData;
}

/*
 * --------------------------------------------------
 * TIMEZONE CHECK
 * --------------------------------------------------
 */

function isTimeInsideZone(
  time:string,
  timeZone:TimeZone
):boolean {
  if(!time||!timeZone.start||!timeZone.end) return false;

  const messageMin=timeToMinutes(time);
  const startMin=timeToMinutes(timeZone.start);
  const endMin=timeToMinutes(timeZone.end);

  if(messageMin<0||startMin<0||endMin<0) return false;

  return messageMin>=startMin&&messageMin<=endMin;
}

/*
 * Same timezone check using pre-computed minutes.
 * Keeps the same boundary behavior as isTimeInsideZone().
 */

function isTimeInsidePrecomputedZone(
  messageMin:number,
  startMin:number,
  endMin:number
):boolean {
  if(messageMin<0||startMin<0||endMin<0) return false;
  return messageMin>=startMin&&messageMin<=endMin;
}

/*
 * --------------------------------------------------
 * ATTENDANCE SUMMARY
 * --------------------------------------------------
 */

export function generateAttendanceSummary(
  attendanceData:AttendanceRecord[],
  names:string[],
  selectedDates:string[],
  timeZones:TimeZone[]
):SummaryRecord[] {
  if(
    attendanceData.length===0||
    names.length===0||
    selectedDates.length===0
  ){
    return [];
  }

  const selectedDateSet=new Set(selectedDates);

  const zoneMinutes=timeZones.slice(0,3).map(zone=>({
    start:zone?.start?timeToMinutes(zone.start):-1,
    end:zone?.end?timeToMinutes(zone.end):-1,
  }));

  const records=new Map<string,SummaryRecord>();

  attendanceData.forEach(record=>{
    if(!record.date||!selectedDateSet.has(record.date)) return;

    const employeeName=record.name.trim();
    if(!employeeName) return;

    let summary=records.get(employeeName);

    if(!summary){
      summary={
        name:employeeName,
        count1:0,
        count2:0,
        count3:0,
        total:0,
      };
      records.set(employeeName,summary);
    }

    const checkIn=record.checkIn;
    if(!checkIn) return;

    const messageMin=timeToMinutes(checkIn);
    if(messageMin<0) return;

    const zone1=zoneMinutes[0];
    const zone2=zoneMinutes[1];
    const zone3=zoneMinutes[2];

    if(
      zone1&&
      isTimeInsidePrecomputedZone(
        messageMin,
        zone1.start,
        zone1.end
      )
    ){
      summary.count1++;
    }

    if(
      zone2&&
      isTimeInsidePrecomputedZone(
        messageMin,
        zone2.start,
        zone2.end
      )
    ){
      summary.count2++;
    }

    if(
      zone3&&
      isTimeInsidePrecomputedZone(
        messageMin,
        zone3.start,
        zone3.end
      )
    ){
      summary.count3++;
    }
  });

  records.forEach(record=>{
    record.total=
      record.count1+
      record.count2+
      record.count3;
  });

  return Array.from(records.values()).sort(sortByName);
}

/*
 * --------------------------------------------------
 * MONTHLY PENALTY FILTER
 * --------------------------------------------------
 */

export function filterPenaltyByMonth(
  penaltyData:PenaltyRecord[],
  month:number|'all',
  year:number|'all'
):PenaltyRecord[] {
  if(!penaltyData.length) return [];

  if(month==='all'&&year==='all') return penaltyData;

  const isoCache=new Map<string,string|null>();
  const matchesCache=new Map<string,boolean>();

  return penaltyData.filter(record=>{
    if(!record.date) return false;

    const date=record.date;

    let isoDate=isoCache.get(date);

    if(isoDate===undefined){
      const converted=convertRawDateToISO(date);
      isoDate=converted||null;
      isoCache.set(date,isoDate);
    }

    if(!isoDate) return false;

    let matches=matchesCache.get(date);

    if(matches!==undefined) return matches;

    const parts=isoDate.split('-');

    if(parts.length!==3){
      matchesCache.set(date,false);
      return false;
    }

    const recordYear=Number(parts[0]);
    const recordMonth=Number(parts[1]);

    if(
      Number.isNaN(recordYear)||
      Number.isNaN(recordMonth)
    ){
      matchesCache.set(date,false);
      return false;
    }

    const yearMatches=year==='all'||recordYear===year;
    const monthMatches=month==='all'||recordMonth===month;

    matches=yearMatches&&monthMatches;
    matchesCache.set(date,matches);

    return matches;
  });
}

/*
 * --------------------------------------------------
 * PENALTY DATE FILTER
 * --------------------------------------------------
 */

export function filterPenaltyByDate(
  penaltyData:PenaltyRecord[],
  selectedDate:string
):PenaltyRecord[] {
  if(!penaltyData.length||!selectedDate) return [];

  return penaltyData
    .filter(record=>{
      if(!record.date) return false;
      return convertRawDateToISO(record.date)===selectedDate;
    })
    .sort(sortByName);
}

/*
 * --------------------------------------------------
 * MONTHLY PENALTY AGGREGATION
 * --------------------------------------------------
 */

export function aggregatePenaltyByEmployee(
  penaltyData:PenaltyRecord[],
  month:number|'all',
  year:number|'all'
):PenaltyRecord[] {
  const filtered=filterPenaltyByMonth(
    penaltyData,
    month,
    year
  );

  if(!filtered.length) return [];

  const grouped=new Map<string,PenaltyRecord>();
  const reasonSets=new Map<string,Set<string>>();

  filtered.forEach(record=>{
    const normalizedName=record.name.trim().toLowerCase();
    if(!normalizedName) return;

    const amount=Number(record.penalty||0);
    const validAmount=Number.isFinite(amount)?amount:0;

    let existing=grouped.get(normalizedName);

    if(!existing){
      existing={
        displayName:record.displayName,
        name:record.name,
        date:'',
        penalty:validAmount.toString(),
        penaltyReason:record.penaltyReason||'',
      };

      grouped.set(normalizedName,existing);

      const reasons=new Set<string>();

      if(record.penaltyReason&&record.penaltyReason.trim()){
        reasons.add(record.penaltyReason.trim());
      }

      reasonSets.set(normalizedName,reasons);
      return;
    }

    const currentAmount=Number(existing.penalty||0);

    existing.penalty=(
      currentAmount+validAmount
    ).toString();

    if(
      record.penaltyReason&&
      record.penaltyReason.trim()
    ){
      const newReason=record.penaltyReason.trim();
      const reasons=reasonSets.get(normalizedName);

      if(
        reasons&&
        !Array.from(reasons).some(
          reason=>reason.toLowerCase()===newReason.toLowerCase()
        )
      ){
        reasons.add(newReason);
        existing.penaltyReason=Array.from(reasons).join(' | ');
      }
    }
  });

  return Array.from(grouped.values()).sort(
    (a,b)=>a.name.localeCompare(b.name)
  );
}