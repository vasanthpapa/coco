import { useState } from 'react';
import { parsePermissionDuration } from '../../utils/attendanceUtils';

interface DateWiseRow {
  name: string;
  checkIn: string;
  checkOut: string;
  permission: string;
  halfDay: string;
}

interface DateWiseReportProps {
  selectedDateISO: string;
  onDateChange: (date: string) => void;
  data: DateWiseRow[];
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

export default function DateWiseReport({
  selectedDateISO,
  onDateChange,
  data,
  maxDate,
}: DateWiseReportProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter(row =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in">
      <div className="flex items-center gap-4 mb-6 flex-wrap">

        {/* Search Employee */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-medium">
            Search:
          </label>

          <input
            type="text"
            value={searchTerm}
            onChange={event =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search employee..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Select Date */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-medium">
            Select Date:
          </label>

          <input
            type="date"
            value={selectedDateISO}
            max={maxDate || ''}
            onChange={event =>
              onDateChange(event.target.value)
            }
            className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-primary [color-scheme:dark]"
          />
        </div>

      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4">
                Employee Name
              </th>

              <th className="px-6 py-4">
                Check In
              </th>

              <th className="px-6 py-4">
                Check Out
              </th>

              <th className="px-6 py-4 text-center">
                Permission
              </th>

              <th className="px-6 py-4 text-center">
                Half Day
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredData.map((row, index) => (
              <tr
                key={`${row.name}-${index}`}
                className="border-b border-slate-800 hover:bg-slate-800/50"
              >
                <td className="px-6 py-4 font-bold text-white">
                  {row.name}
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
              </tr>
            ))}

            {filteredData.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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
