import React, { useMemo } from 'react';

interface DataStatsProps {
  data: Record<string, any>[];
}

export default function DataStats({ data }: DataStatsProps) {
  const stats = useMemo(() => {
    if (data.length === 0) return [];
    
    const keys = new Set<string>();
    data.forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(k => keys.add(k))
      }
    });
    
    return Array.from(keys).map(key => {
      let numericCount = 0;
      let totalSum = 0;
      let min = Infinity;
      let max = -Infinity;
      let nonNullCount = 0;

      data.forEach(row => {
        if (!row) return;
        const val = row[key];
        if (val !== null && val !== undefined && val !== '') {
          nonNullCount++;
          const num = Number(val);
          if (!isNaN(num) && typeof val !== 'boolean') {
            numericCount++;
            totalSum += num;
            if (num < min) min = num;
            if (num > max) max = num;
          }
        }
      });

      const isNumeric = numericCount > 0 && numericCount === nonNullCount;

      return {
        key,
        nonNullCount,
        isNumeric,
        min: isNumeric ? min : null,
        max: isNumeric ? max : null,
        avg: isNumeric ? (totalSum / numericCount).toFixed(2) : null
      };
    });
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="card p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4 rounded-tl-lg">Column Name</th>
              <th className="px-6 py-4 text-right">Valid Rows</th>
              <th className="px-6 py-4 text-center">Type</th>
              <th className="px-6 py-4 text-right">Min</th>
              <th className="px-6 py-4 text-right">Max</th>
              <th className="px-6 py-4 text-right rounded-tr-lg">Avg</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(stat => (
              <tr key={stat.key} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-medium text-white">{stat.key}</td>
                <td className="px-6 py-4 text-right">{stat.nonNullCount.toLocaleString()} / {data.length.toLocaleString()}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${stat.isNumeric ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {stat.isNumeric ? 'Number' : 'Text'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-slate-400">{stat.isNumeric ? stat.min : '-'}</td>
                <td className="px-6 py-4 text-right text-slate-400">{stat.isNumeric ? stat.max : '-'}</td>
                <td className="px-6 py-4 text-right text-slate-400">{stat.isNumeric ? stat.avg : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
