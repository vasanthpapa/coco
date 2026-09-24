import {
  CalendarCheck,
  FileText,
  Table,
  BarChart3,
} from 'lucide-react';

import type { ReportType } from './reportTypes';

interface ReportNavigationProps {
  reportType: ReportType;
  onSelect: (type: ReportType) => void;
}

export default function ReportNavigation({
  reportType,
  onSelect,
}: ReportNavigationProps) {
  const reports = [
    {
      id: 'name' as const,
      label: 'Name Wise',
      icon: <Table className="h-4 w-4" />,
    },
    {
      id: 'date' as const,
      label: 'Date Wise',
      icon: <CalendarCheck className="h-4 w-4" />,
    },
    {
      id: 'pdf' as const,
      label: 'Multiple Dates',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 'analytics' as const,
      label: 'Employee Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {reports.map(report => (
        <button
          key={report.id}
          type="button"
          onClick={() => onSelect(report.id)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
            reportType === report.id
              ? 'bg-primary text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {report.icon}
          {report.label}
        </button>
      ))}
    </div>
  );
}