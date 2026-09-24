import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

import type {
  TimeZone,
  SummaryRecord,
} from '../../utils/reportParser';

import {
  convertRawDateToISO,
  formatDateDDMMYY,
} from '../../utils/attendanceUtils';

interface PdfSummaryReportProps {
  dates: string[];
  selectedDates: string[];
  onSelectedDatesChange: (
    dates: string[]
  ) => void;
  timeZones: TimeZone[];
  onTimeZonesChange: (
    zones: TimeZone[]
  ) => void;
  summaryData: SummaryRecord[];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function PdfSummaryReport({
  dates,
  selectedDates,
  onSelectedDatesChange,
  timeZones,
  onTimeZonesChange,
  summaryData,
}: PdfSummaryReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  // Get available years from the existing dates.
  const availableYears = useMemo(() => {
    const years = new Set<string>();

    dates.forEach(date => {
      const isoDate = convertRawDateToISO(date);

      if (isoDate) {
        const year = isoDate.slice(0, 4);

        if (year) {
          years.add(year);
        }
      }
    });

    return Array.from(years).sort(
      (a, b) => Number(b) - Number(a)
    );
  }, [dates]);

  // Filter dates using the selected month and year.
const filteredDates = useMemo(() => {
  return dates
    .filter(date => {
      const isoDate = convertRawDateToISO(date);

      if (!isoDate) {
        return false;
      }

      const dateYear = isoDate.slice(0, 4);
      const dateMonth = String(
        Number(isoDate.slice(5, 7))
      );

      const yearMatches =
        selectedYear === 'all' ||
        dateYear === selectedYear;

      const monthMatches =
        selectedMonth === 'all' ||
        dateMonth === selectedMonth;

      return yearMatches && monthMatches;
    })
    .sort((a, b) => {
      const dateA = convertRawDateToISO(a);
      const dateB = convertRawDateToISO(b);

      return dateA.localeCompare(dateB);
    });
}, [
  dates,
  selectedMonth,
  selectedYear,
]);

  // Remove selected dates that are outside the active month/year filter.
  useEffect(() => {
    const filteredDateSet =
      new Set(filteredDates);

    const validSelectedDates =
      selectedDates.filter(date =>
        filteredDateSet.has(date)
      );

    if (
      validSelectedDates.length !==
      selectedDates.length
    ) {
      onSelectedDatesChange(
        validSelectedDates
      );
    }
  }, [
    filteredDates,
    selectedDates,
    onSelectedDatesChange,
  ]);

  // Toggle an individual date.
  const toggleDate = (date: string) => {
    onSelectedDatesChange(
      selectedDates.includes(date)
        ? selectedDates.filter(
            item => item !== date
          )
        : [
            ...selectedDates,
            date,
          ]
    );
  };

  // Handle month filter change.
  const handleMonthChange = (
    value: string
  ) => {
    setSelectedMonth(value);
  };

  // Handle year filter change.
  const handleYearChange = (
    value: string
  ) => {
    setSelectedYear(value);
  };

  // Handle time zone change.
  const handleTimeZoneChange = (
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    onTimeZonesChange(
      timeZones.map(
        (zone, zoneIndex) =>
          zoneIndex === index
            ? {
                ...zone,
                [field]: value,
              }
            : zone
      )
    );
  };

  // Keep selected dates in the same order as the displayed date list.
  const visibleSelectedDates =
    filteredDates.filter(date =>
      selectedDates.includes(date)
    );

  // Filter summary rows using employee search.
  const filteredSummaryData =
    summaryData.filter(row =>
      String(row.name)
        .toLowerCase()
        .includes(
          searchTerm.toLowerCase()
        )
    );

  return (
    <div className="animate-in fade-in space-y-8">
      {/* CONFIGURATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DATE SELECTION */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h4 className="font-bold text-slate-300">
              1. Select Dates
            </h4>

            <div className="flex items-center gap-2">
              {/* MONTH FILTER */}
              <select
                value={selectedMonth}
                onChange={event =>
                  handleMonthChange(
                    event.target.value
                  )
                }
                className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-primary"
              >
                <option value="all">
                  All Months
                </option>

                {MONTHS.map(
                  (month, index) => (
                    <option
                      key={month}
                      value={String(index + 1)}
                    >
                      {month}
                    </option>
                  )
                )}
              </select>

              {/* YEAR FILTER */}
              <select
                value={selectedYear}
                onChange={event =>
                  handleYearChange(
                    event.target.value
                  )
                }
                className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-primary"
              >
                <option value="all">
                  All Years
                </option>

                {availableYears.map(
                  year => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}
              </select>

              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onSelectedDatesChange(
                      []
                    )
                  }
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {filteredDates.map(date => (
              <button
                key={date}
                type="button"
                onClick={() =>
                  toggleDate(date)
                }
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedDates.includes(
                    date
                  )
                    ? 'bg-primary text-white'
                    : 'bg-slate-800 border border-slate-600 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {formatDateDDMMYY(date)}
              </button>
            ))}

            {filteredDates.length === 0 && (
              <p className="text-sm text-slate-500">
                No dates available for the
                selected month/year.
              </p>
            )}
          </div>
        </div>

        {/* TIME ZONES */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <h4 className="font-bold mb-3 text-slate-300">
            2. Configure Time Zones
          </h4>

          <div className="space-y-3">
            {timeZones.map(
              (zone, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3"
                >
                  <span className="text-slate-400 text-sm w-16">
                    Zone {index + 1}:
                  </span>

                  <input
                    type="time"
                    value={zone.start}
                    onChange={event =>
                      handleTimeZoneChange(
                        index,
                        'start',
                        event.target.value
                      )
                    }
                    className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white"
                  />

                  <span className="text-slate-500">
                    -
                  </span>

                  <input
                    type="time"
                    value={zone.end}
                    onChange={event =>
                      handleTimeZoneChange(
                        index,
                        'end',
                        event.target.value
                      )
                    }
                    className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white"
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* SUMMARY PREVIEW */}
      {selectedDates.length > 0 && (
        <div className="bg-white p-8 rounded-xl text-black shadow-lg">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">
              Attendance Summary
            </h2>

            <div className="text-gray-500 text-sm">
              Selected Dates:{' '}
              {visibleSelectedDates
  .map(date => formatDateDDMMYY(date))
  .join(', ')}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search Employee
            </label>

            <div className="relative w-full md:w-96">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />

              <input
                type="text"
                value={searchTerm}
                onChange={event =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search employee name..."
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchTerm('')
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#2c3e50] text-white">
                <tr>
                  <th className="px-4 py-3 border border-gray-300">
                    Name
                  </th>

                  <th className="px-4 py-3 text-center border border-gray-300">
                    {timeZones[0]?.start}
                  </th>

                  <th className="px-4 py-3 text-center border border-gray-300">
                    {timeZones[1]?.start}
                  </th>

                  <th className="px-4 py-3 text-center border border-gray-300">
                    {timeZones[2]?.start}
                  </th>

                  <th className="px-4 py-3 text-center border border-gray-300">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSummaryData.map(
                  row => (
                    <tr key={row.name}>
                      <td className="px-4 py-3 font-bold border border-gray-200">
                        {row.name}
                      </td>

                      <td className="px-4 py-3 text-center border border-gray-200">
                        {row.count1 ||
                          'NIL'}
                      </td>

                      <td className="px-4 py-3 text-center border border-gray-200">
                        {row.count2 ||
                          'NIL'}
                      </td>

                      <td className="px-4 py-3 text-center border border-gray-200">
                        {row.count3 ||
                          'NIL'}
                      </td>

                      <td className="px-4 py-3 text-center font-bold border border-gray-200">
                        {row.total}
                      </td>
                    </tr>
                  )
                )}

                {filteredSummaryData.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-8 text-gray-500"
                    >
                      No attendance records
                      found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}