import React, { useEffect, useMemo, useState } from 'react';

import type { PenaltyRecord } from '../../utils/penaltyParser';
import type { PeriodFilter } from './reportTypes';
import {
  resolveOriginalEmployeeName,
  formatDateDDMMYY,
} from '../../utils/attendanceUtils';
interface PenaltyReportProps {
  overallData: PenaltyRecord[];
  explicitData: PenaltyRecord[];

  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;

  years: number[];

  selectedDate: string;
  onDateChange: (date: string) => void;
}

type ViewMode = 'overall' | 'explicit';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

/* --------------------------------------------------
 * DATE HELPERS
 * -------------------------------------------------- */

function normalizeDate(date: string): string {
  if (!date) {
    return '';
  }

  const value = date.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parts = value.split(/[/-]/);

  if (parts.length !== 3) {
    return '';
  }

  let year: string;
  let month: string;
  let day: string;

  if (parts[0].length === 4) {
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    const first = Number(parts[0]);
    const second = Number(parts[1]);

    // MM/DD/YYYY
    if (first <= 12 && second > 12) {
      month = parts[0];
      day = parts[1];
      year = parts[2];
    } else {
      // DD/MM/YYYY
      day = parts[0];
      month = parts[1];
      year = parts[2];
    }
  }

  if (year.length === 2) {
    year = `20${year}`;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function formatDisplayDate(date: string): string {
  const iso = normalizeDate(date);

  if (!iso) {
    return '-';
  }

  const parts = iso.split('-');

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/* --------------------------------------------------
 * COMPONENT
 * -------------------------------------------------- */

export default function PenaltyReport({
  overallData,
  explicitData,
  period,
  onPeriodChange,
  years,
  selectedDate,
  onDateChange,
}: PenaltyReportProps) {
  /* --------------------------------------------------
   * VIEW MODE
   * -------------------------------------------------- */

  const [viewMode, setViewMode] =
    useState<ViewMode>('overall');

  /* --------------------------------------------------
   * SEARCH
   * -------------------------------------------------- */

  const [search, setSearch] = useState('');

  /* --------------------------------------------------
   * FROM / TO DATE
   * -------------------------------------------------- */

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  /* --------------------------------------------------
   * DATE RANGE
   *
   * Date picker is restricted to selected
   * month + year.
   * -------------------------------------------------- */

  const dateRange = useMemo(() => {
    if (
      period.month === 'all' ||
      period.year === 'all'
    ) {
      return {
        min: '',
        max: '',
      };
    }

    const year = Number(period.year);
    const month = Number(period.month);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month)
    ) {
      return {
        min: '',
        max: '',
      };
    }

    const lastDay = new Date(
      year,
      month,
      0
    ).getDate();

    const monthString = String(month).padStart(2, '0');

    return {
      min: `${year}-${monthString}-01`,
      max: `${year}-${monthString}-${String(
        lastDay
      ).padStart(2, '0')}`,
    };
  }, [
    period.month,
    period.year,
  ]);

  /* --------------------------------------------------
   * OVERALL DATA FOR DATE RANGE
   *
   * IMPORTANT:
   *
   * overallData is already employee-wise aggregated,
   * so it may not contain individual dates.
   *
   * Therefore when From / To is selected,
   * aggregate from explicitData instead.
   *
   * Existing penalty parser is NOT changed.
   * -------------------------------------------------- */

  const filteredOverallData = useMemo(() => {
    /*
     * No date filter:
     * use existing overallData exactly as before.
     */
    if (!fromDate && !toDate) {
      return overallData;
    }

    if (!Array.isArray(explicitData)) {
      return [];
    }

    const employeeMap = new Map<
      string,
      PenaltyRecord
    >();

    explicitData.forEach(record => {
      if (!record.name) {
        return;
      }

      const recordISO = normalizeDate(
        record.date
      );

      /*
       * FROM
       */
      if (
        fromDate &&
        (!recordISO || recordISO < fromDate)
      ) {
        return;
      }

      /*
       * TO
       */
      if (
        toDate &&
        (!recordISO || recordISO > toDate)
      ) {
        return;
      }

      const name = String(
        record.name
      ).trim();

      if (!name) {
        return;
      }

      const existing =
        employeeMap.get(name);

      if (existing) {
        existing.penalty =String(
          Number(existing.penalty || 0) +
          Number(record.penalty || 0));
      } else {
        employeeMap.set(name, {
          ...record,
          name,
          penalty: String(
            Number(record.penalty || 0)
          ),
        });
      }
    });

    return Array.from(
      employeeMap.values()
    );
  }, [
    overallData,
    explicitData,
    fromDate,
    toDate,
  ]);

  /* --------------------------------------------------
   * CURRENT DATA
   * -------------------------------------------------- */

  const currentData =
    viewMode === 'overall'
      ? filteredOverallData
      : explicitData;

  /* --------------------------------------------------
   * SEARCH + DATE FILTER
   * -------------------------------------------------- */

const visibleData = useMemo(() => {
  if (!Array.isArray(currentData)) {
    return [];
  }

  const searchText = search.trim().toLowerCase();

  return currentData.filter(record => {
    const recordISO = normalizeDate(record.date);

    // Specific date filter
    if (
      selectedDate &&
      recordISO !== selectedDate
    ) {
      return false;
    }

    // From date
    if (
      fromDate &&
      (!recordISO || recordISO < fromDate)
    ) {
      return false;
    }

    // To date
    if (
      toDate &&
      (!recordISO || recordISO > toDate)
    ) {
      return false;
    }

    if (!searchText) {
      return true;
    }

    const name = String(
      record.name || ''
    ).toLowerCase();

    const reason = String(
      record.penaltyReason || ''
    ).toLowerCase();

    const rawDate = String(
      record.date || ''
    ).toLowerCase();

    const displayDate =
      formatDisplayDate(
        record.date
      ).toLowerCase();

    return (
      name.includes(searchText) ||
      reason.includes(searchText) ||
      rawDate.includes(searchText) ||
      displayDate.includes(searchText)
    );
  });
}, [
  currentData,
  search,
  selectedDate,
  fromDate,
  toDate,
]);

  /* --------------------------------------------------
   * VALIDATE DATE WHEN MONTH/YEAR CHANGES
   * -------------------------------------------------- */

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    if (
      period.month === 'all' ||
      period.year === 'all'
    ) {
      return;
    }

    const parts = selectedDate.split('-');

    if (parts.length !== 3) {
      onDateChange('');
      return;
    }

    const selectedYear = Number(parts[0]);
    const selectedMonth = Number(parts[1]);

    const yearMatches =
      selectedYear === period.year;

    const monthMatches =
      selectedMonth === period.month;

    if (
      !yearMatches ||
      !monthMatches
    ) {
      onDateChange('');
    }
  }, [
    selectedDate,
    period.month,
    period.year,
    onDateChange,
  ]);

  /* --------------------------------------------------
   * VIEW CHANGE
   * -------------------------------------------------- */

  const handleViewChange = (
    mode: ViewMode
  ) => {
    setViewMode(mode);

    /*
     * Clear selected date whenever
     * switching between Overall / Explicit.
     */
    onDateChange('');
  };

  /* --------------------------------------------------
   * MONTH CHANGE
   * -------------------------------------------------- */

  const handleMonthChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = event.target.value;

    onPeriodChange({
      ...period,

      month:
        value === 'all'
          ? 'all'
          : Number(value),

      view: viewMode,
    });

    /*
     * Reset specific date because
     * month has changed.
     */
    onDateChange('');
  };

  /* --------------------------------------------------
   * YEAR CHANGE
   * -------------------------------------------------- */

  const handleYearChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = event.target.value;

    onPeriodChange({
      ...period,

      year:
        value === 'all'
          ? 'all'
          : Number(value),

      view: viewMode,
    });

    /*
     * Reset specific date because
     * year has changed.
     */
    onDateChange('');
  };

  /* --------------------------------------------------
   * PENALTY COUNT
   *
   * Existing calculation kept.
   *
   * From / To is applied so that Overall
   * count matches the selected range.
   * -------------------------------------------------- */

  const penaltyCountByEmployee = useMemo(() => {
    if (!Array.isArray(explicitData)) {
      return new Map<string, number>();
    }

    const counts =
      new Map<string, number>();

    explicitData.forEach(record => {
      if (!record.name) {
        return;
      }

      /*
       * FROM DATE
       */
      if (fromDate) {
        const recordISO =
          normalizeDate(record.date);

        if (
          !recordISO ||
          recordISO < fromDate
        ) {
          return;
        }
      }

      /*
       * TO DATE
       */
      if (toDate) {
        const recordISO =
          normalizeDate(record.date);

        if (
          !recordISO ||
          recordISO > toDate
        ) {
          return;
        }
      }

      const name =
        String(record.name).trim();

      counts.set(
        name,
        (counts.get(name) || 0) + 1
      );
    });

    return counts;
  }, [
    explicitData,
    fromDate,
    toDate,
  ]);

  /* --------------------------------------------------
   * RENDER
   * -------------------------------------------------- */

  return (
    <div className="animate-in fade-in">

      {/* FILTER BAR */}

      <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">

        <div className="flex flex-col xl:flex-row xl:items-end gap-4">

          {/* SEARCH */}

          <div className="flex-1 min-w-[220px]">

            <label className="block text-sm text-slate-400 mb-2">
              Search
            </label>

            <input
              type="text"
              value={search}
              onChange={event =>
                setSearch(
                  event.target.value
                )
              }
              placeholder={
                viewMode === 'overall'
                  ? 'Search employee...'
                  : 'Search employee, reason or date...'
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
            />

          </div>

          {/* FROM DATE */}

          <div>

            <label className="block text-sm text-slate-400 mb-2">
              From
            </label>

            <input
              type="date"
              value={fromDate}
              max={
                toDate || undefined
              }
              onChange={event =>
                setFromDate(
                  event.target.value
                )
              }
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary [color-scheme:dark]"
            />

          </div>

          {/* TO DATE */}

          <div>

            <label className="block text-sm text-slate-400 mb-2">
              To
            </label>

            <input
              type="date"
              value={toDate}
              min={
                fromDate || undefined
              }
              onChange={event =>
                setToDate(
                  event.target.value
                )
              }
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary [color-scheme:dark]"
            />

          </div>
{/* CLEAR DATE FILTER */}

{(fromDate || toDate) && (
  <div>
    <label className="block text-sm text-slate-400 mb-2">
      &nbsp;
    </label>

    <button
      type="button"
      onClick={() => {
        setFromDate('');
        setToDate('');
      }}
      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white text-sm font-medium transition"
    >
      Clear
    </button>
  </div>
)}
          {/* --------------------------------------------------
              MONTH FILTER
              Temporarily disabled.
              Keep this code for future use.

          <div>

            <label className="block text-sm text-slate-400 mb-2">
              Month
            </label>

            <select
              value={period.month}
              onChange={handleMonthChange}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">
                All Months
              </option>

              {MONTHS.map(month => (
                <option
                  key={month.value}
                  value={month.value}
                >
                  {month.label}
                </option>
              ))}
            </select>

          </div>
          -------------------------------------------------- */}

          {/* --------------------------------------------------
              YEAR FILTER
              Temporarily disabled.
              Keep this code for future use.

          <div>

            <label className="block text-sm text-slate-400 mb-2">
              Year
            </label>

            <select
              value={period.year}
              onChange={handleYearChange}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">
                All Years
              </option>

              {years.map(year => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}
            </select>

          </div>
          -------------------------------------------------- */}

          {/* OVERALL / EXPLICIT */}

          <div>

            <label className="block text-sm text-slate-400 mb-2">
              View
            </label>

            <div className="flex bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">

              <button
                type="button"
                onClick={() =>
                  handleViewChange(
                    'overall'
                  )
                }
                className={`px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'overall'
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Overall
              </button>

              <button
                type="button"
                onClick={() =>
                  handleViewChange(
                    'explicit'
                  )
                }
                className={`px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'explicit'
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Explicit
              </button>

            </div>

          </div>

          {/* --------------------------------------------------
              SPECIFIC DATE FILTER
              Temporarily disabled.
              Keep this code for future use.

          {viewMode === 'explicit' && (
            <div>

              <label className="block text-sm text-slate-400 mb-2">
                Date
              </label>

              <input
                type="date"
                value={selectedDate}
                min={dateRange.min || undefined}
                max={dateRange.max || undefined}
                onChange={event =>
                  onDateChange(
                    event.target.value
                  )
                }
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />

            </div>
          )}
          -------------------------------------------------- */}

        </div>

      </div>

      {/* OVERALL */}

      {viewMode === 'overall' && (
        <div className="overflow-x-auto">

          <table className="w-full text-left text-sm text-slate-300">

            <thead className="text-xs text-slate-400 uppercase bg-slate-800 border-b border-slate-700">

              <tr>

                <th className="px-6 py-4">
                  Employee Name
                </th>

                <th className="px-6 py-4 text-center">
                  Penalty Count
                </th>

                <th className="px-6 py-4 text-center text-rose-400">
                  Total Penalty
                </th>

              </tr>

            </thead>

            <tbody>

              {visibleData.map(
                (row, index) => (
                  <tr
                    key={`${row.name}-${index}`}
                    className="border-b border-slate-800 hover:bg-slate-800/50"
                  >

                    <td className="px-6 py-4 font-bold text-white">
                      {resolveOriginalEmployeeName(row.name)}
                    </td>

                    <td className="px-6 py-4 text-center text-slate-400">
                      {penaltyCountByEmployee.get(
                        String(row.name).trim()
                      ) ?? 0}
                    </td>

                    <td className="px-6 py-4 text-center text-rose-400 font-bold">

                      ₹
                      {Number(
                        row.penalty || 0
                      ).toLocaleString(
                        'en-IN'
                      )}

                    </td>

                  </tr>
                )
              )}

              {visibleData.length === 0 && (
                <tr>

                  <td
                    colSpan={3}
                    className="text-center py-8 text-slate-400"
                  >
                    No penalties found.
                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>
      )}

      {/* EXPLICIT */}

      {viewMode === 'explicit' && (
        <div className="overflow-x-auto">

          <table className="w-full text-left text-sm text-slate-300">

            <thead className="text-xs text-slate-400 uppercase bg-slate-800 border-b border-slate-700">

              <tr>

                <th className="px-6 py-4">
                  Date
                </th>

                <th className="px-6 py-4">
                  Employee Name
                </th>

                <th className="px-6 py-4">
                  Reason
                </th>

                <th className="px-6 py-4 text-center text-rose-400">
                  Penalty
                </th>

              </tr>

            </thead>

            <tbody>

              {visibleData.map(
                (row, index) => (
                  <tr
                    key={`${row.date}-${row.name}-${index}`}
                    className="border-b border-slate-800 hover:bg-slate-800/50"
                  >

                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDateDDMMYY(row.date)}
                    </td>

                    <td className="px-6 py-4 font-bold text-white">
                      {resolveOriginalEmployeeName(row.name)}
                    </td>

                    <td className="px-6 py-4 text-slate-400">
                      {row.penaltyReason || '-'}
                    </td>

                    <td className="px-6 py-4 text-center text-rose-400 font-bold whitespace-nowrap">

                      ₹
                      {Number(
                        row.penalty || 0
                      ).toLocaleString(
                        'en-IN'
                      )}

                    </td>

                  </tr>
                )
              )}

              {visibleData.length === 0 && (
                <tr>

                  <td
                    colSpan={4}
                    className="text-center py-8 text-slate-400"
                  >
                    No penalties found.
                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>
      )}

    </div>
  );
}