import { useMemo, useState } from 'react';
import {
  normalizeEmployeeName,
  formatDateDDMMYY,
  convertRawDateToISO,
  parsePermissionDuration,
} from '../../utils/attendanceUtils';

interface NameWiseRow {
  date: string;
  checkIn: string;
  checkOut: string;
  permission: string;
  halfDay: string;
  weekOff: string;
  penalty?: string;
}

interface NameWiseReportProps {
  names: string[];
  selectedName: string;
  onNameChange: (name: string) => void;
  selectedDateISO: string;
  onDateChange: (date: string) => void;
  data: NameWiseRow[];
  maxDate: string;
}

function getPermissionDisplay(value: string): string {
  const text = String(value || '').trim();

  if (!text || text === '-') {
    return '-';
  }

  const parsed = parsePermissionDuration(text);

  return parsed.displayDuration || 'PERM';
}

type SortOrder = 'asc' | 'desc';

export default function NameWiseReport({
  names,
  selectedName,
  onNameChange,
  selectedDateISO,
  onDateChange,
  data,
  maxDate,
}: NameWiseReportProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
 

  const normalizedNames = useMemo(() => {
    return Array.from(
      new Set(
        names
          .map(name => normalizeEmployeeName(name, names))
          .filter(Boolean)
      )
    );
  }, [names]);

 const sortedData = useMemo(() => {
  return [...data].sort((a, b) => {
    const dateA = parseDateToSortableValue(a.date);
    const dateB = parseDateToSortableValue(b.date);
    if (sortOrder === 'asc') {
      return dateA - dateB;
    }
    return dateB - dateA;
  });
}, [data, sortOrder]);

const datePickerValue =
  convertRawDateToISO(selectedDateISO);

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-wrap items-center gap-4 mb-6">

        {/* Employee */}
        <div className="flex items-center gap-3">
          <label className="text-slate-400 font-medium">
            Select Employee:
          </label>

          <select
            value={selectedName}
            onChange={event => onNameChange(event.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
          >
            {normalizedNames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-3">
  <label className="text-slate-400 font-medium">
    Date:
  </label>
  <input
  type="date"
  value={datePickerValue}
  max={maxDate || ''}
  onChange={event => onDateChange(event.target.value)}
  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary [color-scheme:dark]"
/>
  {selectedDateISO && (
    <button
      type="button"
      onClick={() => onDateChange('')}
      className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg"
    >
      Clear
    </button>
  )}
</div>

        {/* Date Sort */}
        <div className="flex items-center gap-3">
          <label className="text-slate-400 font-medium">
            Sort:
          </label>

          <select
            value={sortOrder}
            onChange={event =>
              setSortOrder(event.target.value as SortOrder)
            }
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Check In</th>
              <th className="px-6 py-4">Check Out</th>
              <th className="px-6 py-4 text-center">Permission</th>
              <th className="px-6 py-4 text-center">Half Day</th>
              <th className="px-6 py-4 text-center text-rose-400">
                Penalty
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedData.map((row, index) => (
              <tr
                key={`${row.date}-${index}`}
                className="border-b border-slate-800 hover:bg-slate-800/50"
              >
                <td className="px-6 py-4 font-bold text-white">
                  {formatDateDDMMYY(row.date)}
                </td>

                <td className="px-6 py-4 text-emerald-400">
                  {row.checkIn}
                </td>

                <td className="px-6 py-4 text-rose-400">
                  {row.checkOut}
                </td>

                <td className="px-6 py-4 text-center">
  {getPermissionDisplay(row.permission) === '-' ? (
    '-'
  ) : (
    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-bold text-xs">
      {getPermissionDisplay(row.permission)}
    </span>
  )}
</td>

                <td className="px-6 py-4 text-center">
                  {row.halfDay === 'Yes' ? (
                    <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded font-bold text-xs">
                      HD
                    </span>
                  ) : (
                    '-'
                  )}
                </td>

                <td className="px-6 py-4 text-center text-rose-400 font-bold">
                  {row.penalty || '-'}
                </td>
              </tr>
            ))}

            {sortedData.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-8 text-slate-400"
                >
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function normalizeDate(date: string): string {
  if (!date) return '';

  const normalized = date.trim().replace(/\//g, '-');
  const parts = normalized.split('-');

  if (parts.length !== 3) return '';

  if (parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const [day, month, year] = parts;

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseDateToSortableValue(date: string): number {
  if (!date) return 0;

  const normalized = date.trim().replace(/\//g, '-');
  const parts = normalized.split('-');

  if (parts.length !== 3) return 0;

  if (parts[0].length === 4) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    return year * 10000 + month * 100 + day;
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  return year * 10000 + month * 100 + day;
}
