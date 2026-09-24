import { useEffect, useMemo, useState } from 'react';
import {
  CUSTOM_NAME_ORDER,
  convertRawDateToISO,
  createNameResolver,
  sortByName,
} from '../utils/attendanceUtils';
import type {
  AttendanceRecord,
  NameMapping,
} from '../utils/attendanceUtils';
import {
  generateNameWiseReport,
  generateDateWiseReport,
  generateAttendanceSummary,
  aggregatePenaltyByEmployee,
} from '../utils/reportParser';
import type {
  TimeZone,
  SummaryRecord,
} from '../utils/reportParser';
import type { PenaltyRecord } from '../utils/penaltyParser';
import type {
  ReportType,
  PeriodFilter,
} from './reports/reportTypes';
import type { AnalyticsFilter } from '../utils/employeeAnalyticsUtils';
import ReportNavigation from './reports/ReportNavigation';
import NameWiseReport from './reports/NameWiseReport';
import DateWiseReport from './reports/DateWiseReport';
import PdfSummaryReport from './reports/PdfSummaryReport';
import PenaltyReport from './reports/PenaltyReport';
import EmployeeAnalytics from './reports/EmployeeAnalytics';

interface ReportsModuleProps {
  attendanceData: AttendanceRecord[];
  penaltyData: PenaltyRecord[];
  mappings: NameMapping[];
}

export default function ReportsModule({
  attendanceData,
  penaltyData,
  mappings,
}: ReportsModuleProps) {
  const [reportType, setReportType] = useState<ReportType>('name');
  const [selectedName, setSelectedName] = useState('');
  const [selectedDateISO, setSelectedDateISO] = useState('');
  const [selectedPdfDates, setSelectedPdfDates] = useState<string[]>([]);
  const [selectedNameDateISO, setSelectedNameDateISO] = useState('');
  const [timeZones, setTimeZones] = useState<TimeZone[]>([
    { start: '02:15', end: '02:45' },
    { start: '05:00', end: '05:15' },
    { start: '05:00', end: '06:30' },
  ]);
  const [penaltyPeriod, setPenaltyPeriod] = useState<PeriodFilter>({
    month: 'all',
    year: 'all',
    view: 'overall',
  });
  const [selectedPenaltyDate, setSelectedPenaltyDate] = useState('');
  const [analyticsFilter, setAnalyticsFilter] = useState<AnalyticsFilter>(() => {
    const now = new Date();
    return {
      period: 'overall',
      date: now.toISOString().slice(0, 10),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
  });

  const dates = useMemo(() => {
    const dateSet = new Set<string>();
    attendanceData.forEach(record => {
      if (record.date) dateSet.add(record.date);
    });
    penaltyData.forEach(record => {
      if (record.date) dateSet.add(record.date);
    });

    const dateCache = new Map<string, string>();
    const getISODate = (date: string) => {
      const cached = dateCache.get(date);
      if (cached !== undefined) return cached;
      const iso = convertRawDateToISO(date) || '';
      dateCache.set(date, iso);
      return iso;
    };

    return Array.from(dateSet).sort(
      (a, b) => getISODate(b).localeCompare(getISODate(a))
    );
  }, [attendanceData, penaltyData]);

  const names = useMemo(() => {
    const allNames = Array.from(
      new Set([
        ...CUSTOM_NAME_ORDER,
        ...mappings
          .map(mapping => mapping.employeeName?.trim() || '')
          .filter(Boolean),
      ])
    );

    const resolver = createNameResolver(allNames, mappings);
    const nameSet = new Set<string>();

    attendanceData.forEach(record => {
      const name = String(record.name || '').trim();
      if (!name) return;

      const normalizedName = resolver.resolve(name);
      if (normalizedName) nameSet.add(normalizedName);
    });

    return Array.from(nameSet).sort((a, b) =>
      sortByName({ name: a }, { name: b })
    );
  }, [attendanceData, mappings]);

  const analyticsYears = useMemo(() => {
    const yearSet = new Set<number>();
    const dateCache = new Map<string, string>();

    const addYear = (date: string) => {
      if (!date) return;

      let isoDate = dateCache.get(date);
      if (isoDate === undefined) {
        isoDate = convertRawDateToISO(date) || '';
        dateCache.set(date, isoDate);
      }

      if (!isoDate) return;

      const year = Number(isoDate.slice(0, 4));
      if (Number.isFinite(year)) yearSet.add(year);
    };

    attendanceData.forEach(record => addYear(record.date || ''));
    penaltyData.forEach(record => addYear(record.date || ''));

    const years = Array.from(yearSet).sort((a, b) => b - a);

    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    return years;
  }, [attendanceData, penaltyData]);

  const penaltyYears = useMemo(() => {
    const years = new Set<number>();
    const dateCache = new Map<string, string>();

    penaltyData.forEach(record => {
      const date = record.date;
      if (!date) return;

      let isoDate = dateCache.get(date);
      if (isoDate === undefined) {
        isoDate = convertRawDateToISO(date) || '';
        dateCache.set(date, isoDate);
      }

      if (!isoDate) return;

      const year = Number(isoDate.slice(0, 4));
      if (Number.isFinite(year)) years.add(year);
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [penaltyData]);

  const penaltyDates = useMemo(() => {
    const dateSet = new Set<string>();

    penaltyData.forEach(record => {
      if (record.date) dateSet.add(record.date);
    });

    const dateCache = new Map<string, string>();
    const getISODate = (date: string) => {
      const cached = dateCache.get(date);
      if (cached !== undefined) return cached;
      const iso = convertRawDateToISO(date) || '';
      dateCache.set(date, iso);
      return iso;
    };

    return Array.from(dateSet).sort(
      (a, b) => getISODate(b).localeCompare(getISODate(a))
    );
  }, [penaltyData]);

  useEffect(() => {
    if (names.length > 0 && !names.includes(selectedName)) {
      setSelectedName(names[0]);
    }

    if (names.length === 0) {
      setSelectedName('');
    }
  }, [names, selectedName]);

 useEffect(() => {
  if (dates.length === 0) {
    setSelectedDateISO('');
    return;
  }

  if (selectedDateISO) {
    return;
  }

  const dateCache = new Map<string, string>();

  const getISODate = (date: string) => {
    const cached = dateCache.get(date);

    if (cached !== undefined) {
      return cached;
    }

    const iso = convertRawDateToISO(date) || '';

    dateCache.set(date, iso);

    return iso;
  };

  const firstISO = getISODate(dates[0]);

  if (firstISO) {
    setSelectedDateISO(firstISO);
  }
}, [dates, selectedDateISO]);


  useEffect(() => {
    if (penaltyDates.length === 0) {
      setSelectedPenaltyDate('');
      return;
    }

    const dateCache = new Map<string, string>();
    const getISODate = (date: string) => {
      const cached = dateCache.get(date);
      if (cached !== undefined) return cached;
      const iso = convertRawDateToISO(date) || '';
      dateCache.set(date, iso);
      return iso;
    };

    const selectedExists = penaltyDates.some(
      date => getISODate(date) === selectedPenaltyDate
    );

    if (!selectedExists) {
      const firstISO = getISODate(penaltyDates[0]);
      if (firstISO) setSelectedPenaltyDate(firstISO);
    }
  }, [penaltyDates, selectedPenaltyDate]);

  useEffect(() => {
    if (analyticsYears.length === 0) return;

    const currentYear = analyticsFilter.year;

    if (
      typeof currentYear === 'number' &&
      analyticsYears.includes(currentYear)
    ) {
      return;
    }

    setAnalyticsFilter(current => ({
      ...current,
      year: analyticsYears[0],
    }));
  }, [analyticsYears, analyticsFilter.year]);

const nameWiseData = useMemo(() => {
  if (!selectedName) return [];

  const reportData = generateNameWiseReport(
    attendanceData,
    selectedName
  );

  const selectedNameNormalized = selectedName.trim();

  const result = reportData.map(row => {
    const rowISO = convertRawDateToISO(row.date) || '';

    const datePenalty = penaltyData
      .filter(record => {
        const penaltyName = String(record.name || '').trim();

        if (penaltyName !== selectedNameNormalized) {
          return false;
        }

        const penaltyISO =
          convertRawDateToISO(record.date) || '';

        return penaltyISO === rowISO;
      })
      .reduce(
        (total, record) =>
          total + Number(record.penalty || 0),
        0
      );

    return {
      ...row,
      penalty:
        datePenalty > 0
          ? `₹${datePenalty.toLocaleString('en-IN')}`
          : '',
    };
  });

  if (!selectedNameDateISO) {
    return result;
  }

  return result.filter(row => {
    const rowISO =
      convertRawDateToISO(row.date) || '';

    return rowISO === selectedNameDateISO;
  });
}, [
  attendanceData,
  penaltyData,
  selectedName,
  selectedNameDateISO,
]);

  const selectedRawDate = useMemo(() => {
    if (!selectedDateISO) return '';

    const dateCache = new Map<string, string>();

    for (const date of dates) {
      let isoDate = dateCache.get(date);

      if (isoDate === undefined) {
        isoDate = convertRawDateToISO(date) || '';
        dateCache.set(date, isoDate);
      }

      if (isoDate === selectedDateISO) {
        return date;
      }
    }

    return '';
  }, [dates, selectedDateISO]);

  const dateWiseData = useMemo(() => {
    if (!selectedRawDate) return [];

    return generateDateWiseReport(
      attendanceData,
      selectedRawDate
    );
  }, [attendanceData, selectedRawDate]);

  const summaryData = useMemo(() => {
    if (selectedPdfDates.length === 0) return [];

    return generateAttendanceSummary(
      attendanceData,
      names,
      selectedPdfDates,
      timeZones
    );
  }, [
    attendanceData,
    names,
    selectedPdfDates,
    timeZones,
  ]);

  const overallPenaltyData = useMemo(() => {
    return aggregatePenaltyByEmployee(
      penaltyData,
      penaltyPeriod.month,
      penaltyPeriod.year
    );
  }, [
    penaltyData,
    penaltyPeriod.month,
    penaltyPeriod.year,
  ]);

  return (
    <div className="space-y-6">
      <ReportNavigation
        reportType={reportType}
        onSelect={setReportType}
      />

      {reportType === 'name' && (
        <NameWiseReport
  names={names}
  selectedName={selectedName}
  onNameChange={setSelectedName}
  selectedDateISO={selectedNameDateISO}
  onDateChange={setSelectedNameDateISO}
  data={nameWiseData}
  maxDate={convertRawDateToISO(dates[0] || '') || ''}
/>
      )}

      {reportType === 'date' && (
        <DateWiseReport
          selectedDateISO={selectedDateISO}
          onDateChange={setSelectedDateISO}
          data={dateWiseData}
          maxDate={convertRawDateToISO(dates[0] || '') || ''}
        />
      )}

      {reportType === 'pdf' && (
        <PdfSummaryReport
          dates={dates}
          selectedDates={selectedPdfDates}
          onSelectedDatesChange={setSelectedPdfDates}
          timeZones={timeZones}
          onTimeZonesChange={setTimeZones}
          summaryData={summaryData}
        />
      )}

      {reportType === 'penalty' && (
        <PenaltyReport
          overallData={overallPenaltyData}
          explicitData={penaltyData}
          period={penaltyPeriod}
          onPeriodChange={setPenaltyPeriod}
          years={penaltyYears}
          selectedDate={selectedPenaltyDate}
          onDateChange={setSelectedPenaltyDate}
        />
      )}

      {reportType === 'analytics' && (
        <EmployeeAnalytics
          attendanceData={attendanceData}
          penaltyData={penaltyData}
          names={names}
          selectedName={selectedName}
          onNameChange={setSelectedName}
          years={analyticsYears}
          filter={analyticsFilter}
          onFilterChange={setAnalyticsFilter}
        />
      )}
    </div>
  );
}
