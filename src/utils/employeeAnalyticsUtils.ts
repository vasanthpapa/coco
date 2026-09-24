import {
  AttendanceRecord,
  convertRawDateToISO,
  timeToMinutes,
  parsePermissionDuration,
} from './attendanceUtils';
import type { PenaltyRecord } from './penaltyParser';

export type AnalyticsPeriod = 'week' | 'month' | 'year' | 'overall';

export interface AnalyticsFilter {
  period: AnalyticsPeriod;
  date: string;
  month: number | 'all';
  year: number | 'all';
}

export interface EmployeeAnalytics {
  employeeName: string;
  periodLabel: string;
  totalDays: number;
  presentDays: number;
  weekOffDays: number;
  weekOffDates: string[];
  permissionDays: number;
  permissionDates: string[];
  permissionDetails: {
    date: string;
    durationMinutes: number | null;
    displayDuration: string;
    rawText: string;
  }[];
  totalPermissionMinutes: number;
  totalPermissionDuration: string;
  halfDays: number;
  halfDayDates: string[];
  avgCheckIn: string;
  avgCheckOut: string;
  avgWorkingHours: string;
  penaltyCount: number;
  totalPenalty: number;
  avgPenalty: number;
}

interface DateRange {
  start: string;
  end: string;
}

function normalizeName(name: string): string {
  return String(name || '').trim().toLowerCase();
}

function normalizeDate(date: string): string {
  return convertRawDateToISO(String(date || '').trim());
}

function isValidISODate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00`);

  return !Number.isNaN(parsed.getTime());
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function getMonday(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);

  return result;
}

function getSunday(date: Date): Date {
  const monday = getMonday(date);
  monday.setDate(monday.getDate() + 6);
  return monday;
}

export function getAnalyticsDateRange(
  filter: AnalyticsFilter,
  attendanceData: AttendanceRecord[],
  penaltyData: PenaltyRecord[]
): DateRange | null {
  if (filter.period === 'overall') {
    const allDates = [
      ...attendanceData.map(record => normalizeDate(record.date || '')),
      ...penaltyData.map(record => normalizeDate(record.date || '')),
    ].filter(isValidISODate);

    if (!allDates.length) {
      return null;
    }

    allDates.sort();

    return {
      start: allDates[0],
      end: allDates[allDates.length - 1],
    };
  }

  if (filter.period === 'week') {
    if (!filter.date) {
      return null;
    }

    const selectedDate = new Date(`${filter.date}T00:00:00`);

    if (Number.isNaN(selectedDate.getTime())) {
      return null;
    }

    return {
      start: formatDate(getMonday(selectedDate)),
      end: formatDate(getSunday(selectedDate)),
    };
  }

  if (filter.period === 'month') {
    if (filter.month === 'all' || filter.year === 'all') {
      return null;
    }

    const year = Number(filter.year);
    const month = Number(filter.month);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return null;
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    return {
      start: formatDate(start),
      end: formatDate(end),
    };
  }

  if (filter.period === 'year') {
    if (filter.year === 'all') {
      return null;
    }

    const year = Number(filter.year);

    if (!Number.isInteger(year)) {
      return null;
    }

    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    };
  }

  return null;
}

function isDateInRange(
  date: string,
  range: DateRange | null
): boolean {
  if (!range) {
    return true;
  }

  const iso = normalizeDate(date);

  if (!isValidISODate(iso)) {
    return false;
  }

  return iso >= range.start && iso <= range.end;
}

function isYes(value: string): boolean {
  return String(value || '').trim().toLowerCase() === 'yes';
}

function getRecordDateKey(record: AttendanceRecord): string {
  return normalizeDate(record.date || '');
}

function getEmployeeAttendanceRecords(
  attendanceData: AttendanceRecord[],
  employeeName: string,
  range: DateRange | null
): AttendanceRecord[] {
  const targetName = normalizeName(employeeName);

  return attendanceData.filter(record => {
    if (normalizeName(record.name) !== targetName) {
      return false;
    }

    if (!record.date) {
      return false;
    }

    return isDateInRange(record.date, range);
  });
}

function getEmployeePenaltyRecords(
  penaltyData: PenaltyRecord[],
  employeeName: string,
  range: DateRange | null
): PenaltyRecord[] {
  const targetName = normalizeName(employeeName);

  return penaltyData.filter(record => {
    if (normalizeName(record.name) !== targetName) {
      return false;
    }

    if (!record.date) {
      return false;
    }

    return isDateInRange(record.date, range);
  });
}

function getAverageTime(
  records: AttendanceRecord[],
  field: 'checkIn' | 'checkOut'
): string {
  const values = records
    .map(record => timeToMinutes(record[field]))
    .filter(value => value >= 0);

  if (!values.length) {
    return '-';
  }

  const average =
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  return formatMinutesAsTime(average);
}

function formatMinutesAsTime(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) {
    return '-';
  }

  const rounded = Math.round(totalMinutes) % (24 * 60);
  const hours24 = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${pad(hours12)}:${pad(minutes)} ${period}`;
}

function getAverageWorkingMinutes(
  records: AttendanceRecord[]
): number | null {
  const workingDurations: number[] = [];

  records.forEach(record => {
    const checkIn = timeToMinutes(record.checkIn);
    const checkOut = timeToMinutes(record.checkOut);

    if (checkIn < 0 || checkOut < 0) {
      return;
    }

    let duration = checkOut - checkIn;

    if (duration < 0) {
      duration += 24 * 60;
    }

    if (duration > 0 && duration <= 24 * 60) {
      workingDurations.push(duration);
    }
  });

  if (!workingDurations.length) {
    return null;
  }

  return (
    workingDurations.reduce((sum, value) => sum + value, 0) /
    workingDurations.length
  );
}

function formatWorkingHours(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) {
    return '-';
  }

  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;

  return `${hours}h ${pad(remainingMinutes)}m`;
}

function formatPermissionDuration(
  minutes: number
): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 minutes';
  }

  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;

  if (remainingMinutes === 0) {
    return `${hours} ${
      hours === 1 ? 'hour' : 'hours'
    }`;
  }

  if (hours === 0) {
    return `${remainingMinutes} ${
      remainingMinutes === 1
        ? 'minute'
        : 'minutes'
    }`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function getPeriodLabel(
  filter: AnalyticsFilter,
  range: DateRange | null
): string {
  if (!range) {
    return 'No period selected';
  }

  if (filter.period === 'week') {
    return `Week · ${range.start} → ${range.end}`;
  }

  if (filter.period === 'month') {
    const month = Number(filter.month);

    const label = new Date(
      Number(filter.year),
      month - 1,
      1
    ).toLocaleString('en-US', {
      month: 'long',
    });

    return `${label} ${filter.year}`;
  }

  if (filter.period === 'year') {
    return String(filter.year);
  }

  return `${range.start} → ${range.end}`;
}

export function calculateEmployeeAnalytics(
  attendanceData: AttendanceRecord[],
  penaltyData: PenaltyRecord[],
  employeeName: string,
  filter: AnalyticsFilter
): EmployeeAnalytics {
  const range = getAnalyticsDateRange(
    filter,
    attendanceData,
    penaltyData
  );

  const attendanceRecords =
    getEmployeeAttendanceRecords(
      attendanceData,
      employeeName,
      range
    );

  const penaltyRecords =
    getEmployeePenaltyRecords(
      penaltyData,
      employeeName,
      range
    );

  const uniqueAttendanceDates = new Set<string>();

  attendanceRecords.forEach(record => {
    const dateKey = getRecordDateKey(record);

    if (dateKey) {
      uniqueAttendanceDates.add(dateKey);
    }
  });

  const uniqueRecords = new Map<string, AttendanceRecord>();

  attendanceRecords.forEach(record => {
    const dateKey = getRecordDateKey(record);

    if (!dateKey) {
      return;
    }

    const existing = uniqueRecords.get(dateKey);

    if (!existing) {
      uniqueRecords.set(dateKey, record);
      return;
    }

    const existingHasCheckIn =
      timeToMinutes(existing.checkIn) >= 0;

    const currentHasCheckIn =
      timeToMinutes(record.checkIn) >= 0;

    const existingHasCheckOut =
      timeToMinutes(existing.checkOut) >= 0;

    const currentHasCheckOut =
      timeToMinutes(record.checkOut) >= 0;

    const existingPermission = String(
  existing.permission || ''
).trim();

const currentPermission = String(
  record.permission || ''
).trim();

const permission =
  currentPermission &&
  !isYes(currentPermission)
    ? currentPermission
    : existingPermission || currentPermission;
    

    uniqueRecords.set(dateKey, {
      ...existing,
      checkIn:
        !existingHasCheckIn && currentHasCheckIn
          ? record.checkIn
          : existing.checkIn,
      checkOut:
        !existingHasCheckOut && currentHasCheckOut
          ? record.checkOut
          : existing.checkOut,
      permission,
      halfDay:
        isYes(existing.halfDay) || isYes(record.halfDay)
          ? 'Yes'
          : existing.halfDay,
      weekOff:
        isYes(existing.weekOff) || isYes(record.weekOff)
          ? 'Yes'
          : existing.weekOff,
    });
  });

  const records = Array.from(uniqueRecords.values());

const weekOffDates = records
  .filter(record => isYes(record.weekOff))
  .map(record => getRecordDateKey(record))
  .filter(isValidISODate)
  .sort();

const weekOffDays = weekOffDates.length;

const permissionDetails = records
  .filter(record => {
    const permissionText = String(
      record.permission || ''
    ).trim();

    
   if (!permissionText || permissionText === '-'){
      return false;
    }

    const parsed = parsePermissionDuration(permissionText);

    return (
  isYes(permissionText) ||
  parsed.durationMinutes !== null ||
  /permission/i.test(permissionText)
);
  })
  .map(record => {
    const date = getRecordDateKey(record);
    const rawText = String(
      record.permission || ''
    ).trim();

    const parsed = parsePermissionDuration(rawText);

    return {
      date,
      durationMinutes: parsed.durationMinutes,
      displayDuration: parsed.displayDuration,
      rawText,
    };
  })
  .filter(detail =>
    isValidISODate(detail.date)
  )
  .sort((a, b) =>
    a.date.localeCompare(b.date)
  );

const permissionDates =
  permissionDetails.map(
    detail => detail.date
  );

const permissionDays =
  permissionDetails.length;

const totalPermissionMinutes =
  permissionDetails.reduce(
    (sum, detail) =>
      sum + (detail.durationMinutes || 0),
    0
  );

const totalPermissionDuration =
  formatPermissionDuration(
    totalPermissionMinutes
  );
  
const halfDayDates = records
  .filter(record => isYes(record.halfDay))
  .map(record => getRecordDateKey(record))
  .filter(isValidISODate)
  .sort();

const halfDays = halfDayDates.length;

  const presentDays = records.filter(record => {
  if (isYes(record.weekOff)) {
    return false;
  }

  const hasPermission =
    String(record.permission || '').trim() !== '' &&
    !isYes(record.permission);

  return (
    timeToMinutes(record.checkIn) >= 0 ||
    timeToMinutes(record.checkOut) >= 0 ||
    hasPermission ||
    isYes(record.halfDay)
  );
}).length;

  const penaltyAmounts = penaltyRecords
    .map(record => Number(record.penalty || 0))
    .filter(Number.isFinite);

  const totalPenalty = penaltyAmounts.reduce(
    (sum, amount) => sum + amount,
    0
  );

  const avgPenalty = penaltyAmounts.length
    ? totalPenalty / penaltyAmounts.length
    : 0;

  const averageWorkingMinutes =
    getAverageWorkingMinutes(records);

return {
  employeeName,
  periodLabel: getPeriodLabel(filter, range),
  totalDays: uniqueAttendanceDates.size,
  presentDays,
  weekOffDays,
  weekOffDates,
  permissionDays,
  permissionDates,
  permissionDetails,
  totalPermissionMinutes,
  totalPermissionDuration,
  halfDays,
  halfDayDates,
  avgCheckIn: getAverageTime(
    records,
    'checkIn'
  ),
  avgCheckOut: getAverageTime(
    records,
    'checkOut'
  ),
  avgWorkingHours:
    formatWorkingHours(
      averageWorkingMinutes
    ),
  penaltyCount: penaltyRecords.length,
  totalPenalty,
  avgPenalty,
};
}

export function getAnalyticsEmployeeNames(
  attendanceData: AttendanceRecord[],
  penaltyData: PenaltyRecord[]
): string[] {
  const names = new Map<string, string>();

  [...attendanceData.map(record => record.name), ...penaltyData.map(record => record.name)]
    .forEach(name => {
      const cleanName = String(name || '').trim();

      if (!cleanName) {
        return;
      }

      const key = normalizeName(cleanName);

      if (!names.has(key)) {
        names.set(key, cleanName);
      }
    });

  return Array.from(names.values()).sort((a, b) =>
    a.localeCompare(b, undefined, {
      sensitivity: 'base',
    })
  );
}

export function getAnalyticsYears(
  attendanceData: AttendanceRecord[],
  penaltyData: PenaltyRecord[]
): number[] {
  const years = new Set<number>();

  [...attendanceData.map(record => record.date || ''), ...penaltyData.map(record => record.date || '')]
    .forEach(date => {
      const iso = normalizeDate(date);

      if (!isValidISODate(iso)) {
        return;
      }

      const year = Number(iso.slice(0, 4));

      if (Number.isInteger(year)) {
        years.add(year);
      }
    });

  return Array.from(years).sort((a, b) => b - a);
}