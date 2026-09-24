import React, { useMemo } from 'react';

interface DataTableProps {
  data: Record<string, any>[];
}

export default function DataTable({
  data,
}: DataTableProps) {
  const columns = useMemo(() => {
    if (data.length === 0) return [];

    const keys = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      if (
        data[i] &&
        typeof data[i] === 'object'
      ) {
        Object.keys(data[i]).forEach(k =>
          keys.add(k)
        );
      }
    }

    return Array.from(keys);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="text-center p-8 text-slate-400">
        No data available.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">

      {/* Table Scroll Area */}
      <div className="attendance-scroll max-h-[600px] overflow-auto">

        <table className="w-full min-w-max text-left text-sm text-slate-300">

          {/* Header */}
          <thead className="sticky top-0 z-10 bg-slate-800 text-xs text-slate-400 uppercase shadow-md">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col}
                  className={`
                    px-6 py-4
                    whitespace-nowrap
                    font-semibold
                    tracking-wider
                    border-b border-slate-700
                    ${idx === 0 ? 'rounded-tl-lg' : ''}
                    ${
                      idx === columns.length - 1
                        ? 'rounded-tr-lg'
                        : ''
                    }
                  `}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="
                  border-b
                  border-slate-800/50
                  hover:bg-slate-800/50
                  transition-colors
                "
              >
                {columns.map(col => (
                  <td
                    key={col}
                    className="
                      px-6
                      py-3
                      whitespace-nowrap
                      max-w-xs
                      truncate
                    "
                    title={String(row[col] ?? '')}
                  >
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

        </table>

      </div>

    </div>
  );
}