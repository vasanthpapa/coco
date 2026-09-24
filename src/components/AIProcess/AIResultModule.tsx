'use client';

import React, { useState } from 'react';
import {
  Brain,
  CalendarCheck,
  WalletCards,
  Info,
} from 'lucide-react';
import {
  AIAnalysisResult,
  AIAttendanceRecord,
  AIPenaltyRecord,
  AIOtherRecord,
} from '@/src/utils/ai/aiTypes';

interface AIResultModuleProps {
  result: AIAnalysisResult | null;
  isLoading?: boolean;
}

export default function AIResultModule({
  result,
  isLoading = false,
}: AIResultModuleProps) {
  const [tab, setTab] = useState<
    'attendance' | 'penalties' | 'other'
  >('attendance');

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-slate-700 bg-surface p-8 text-center">
          <Brain className="w-8 h-8 mx-auto mb-3 animate-pulse text-primary" />
          <p className="text-sm text-slate-400">
            AI is understanding the WhatsApp data...
          </p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-slate-700 bg-surface p-8 text-center">
          <Brain className="w-8 h-8 mx-auto mb-3 text-slate-500" />
          <p className="text-sm text-slate-400">
            No AI analysis available.
          </p>
        </div>
      </div>
    );
  }

  const attendance = result.attendance || [];
  const penalties = result.penalties || [];
  const other = result.other || [];

  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold text-white">
            AI Analysis
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          AI-extracted meaningful information from the WhatsApp data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={<CalendarCheck className="w-5 h-5" />}
          label="Attendance"
          value={attendance.length}
          active={tab === 'attendance'}
          onClick={() => setTab('attendance')}
        />
        <SummaryCard
          icon={<WalletCards className="w-5 h-5" />}
          label="Penalties"
          value={penalties.length}
          active={tab === 'penalties'}
          onClick={() => setTab('penalties')}
        />
        <SummaryCard
          icon={<Info className="w-5 h-5" />}
          label="Other"
          value={other.length}
          active={tab === 'other'}
          onClick={() => setTab('other')}
        />
      </div>

      {tab === 'attendance' && (
        <AttendanceTable data={attendance} />
      )}

      {tab === 'penalties' && (
        <PenaltyTable data={penalties} />
      )}

      {tab === 'other' && (
        <OtherTable data={other} />
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-colors ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-slate-700 bg-surface hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-3 text-slate-400">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">
        {value}
      </div>
    </button>
  );
}

function AttendanceTable({
  data,
}: {
  data: AIAttendanceRecord[];
}) {
  if (!data.length) {
    return <EmptyState text="No attendance data detected by AI." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Name</Th>
          <Th>Check In</Th>
          <Th>Check Out</Th>
          <Th>Half Day</Th>
          <Th>Permission</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={`${row.date}-${row.name}-${index}`}>
            <Td>{row.date}</Td>
            <Td>{row.name}</Td>
            <Td>{row.checkIn}</Td>
            <Td>{row.checkOut}</Td>
            <Td>{row.halfDay}</Td>
            <Td>{row.permission}</Td>
            <Td>{row.status || '-'}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function PenaltyTable({
  data,
}: {
  data: AIPenaltyRecord[];
}) {
  if (!data.length) {
    return <EmptyState text="No penalties detected by AI." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Name</Th>
          <Th>Amount</Th>
          <Th>Reason</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={`${row.date}-${row.name}-${index}`}>
            <Td>{row.date}</Td>
            <Td>{row.name}</Td>
            <Td>₹{row.amount}</Td>
            <Td>{row.reason}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function OtherTable({
  data,
}: {
  data: AIOtherRecord[];
}) {
  if (!data.length) {
    return <EmptyState text="No other meaningful data detected." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Type</Th>
          <Th>Name</Th>
          <Th>Details</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={`${row.date}-${row.type}-${index}`}>
            <Td>{row.date}</Td>
            <Td>{row.type}</Td>
            <Td>{row.name || '-'}</Td>
            <Td>{row.details}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Table({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-surface">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

function Th({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-700 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="px-4 py-3 text-slate-300 border-b border-slate-800 whitespace-nowrap">
      {children}
    </td>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-surface p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}