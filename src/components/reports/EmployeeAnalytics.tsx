import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  DollarSign,
  UserRound,
  Users,
} from 'lucide-react';

import {
  normalizeEmployeeName,
  type AttendanceRecord,
} from '../../utils/attendanceUtils';
import type { PenaltyRecord } from '../../utils/penaltyParser';
import {
  calculateEmployeeAnalytics,
  type AnalyticsFilter,
  type AnalyticsPeriod,
} from '../../utils/employeeAnalyticsUtils';

interface EmployeeAnalyticsProps {
  attendanceData: AttendanceRecord[];
  penaltyData: PenaltyRecord[];
  names: string[];
  selectedName: string;
  onNameChange: (name: string) => void;
  years: number[];
  filter: AnalyticsFilter;
  onFilterChange: (filter: AnalyticsFilter) => void;
}

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

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-slate-500">
              {description}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-slate-700/60 p-2 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

export default function EmployeeAnalytics({
  attendanceData,
  penaltyData,
  names,
  selectedName,
  onNameChange,
  years,
  filter,
  onFilterChange,
}: EmployeeAnalyticsProps) {
    const normalizedNames = useMemo(() => {
  return Array.from(
    new Set(
      names
        .map(name =>
          normalizeEmployeeName(name, names)
        )
        .filter(Boolean)
    )
  );
}, [names]);
  const analytics = useMemo(
    () =>
      calculateEmployeeAnalytics(
        attendanceData,
        penaltyData,
        selectedName,
        filter
      ),
    [
      attendanceData,
      penaltyData,
      selectedName,
      filter,
    ]
  );
  type DateListType = 'weekOff' | 'permission' | 'halfDay' | null;

const [showDateList, setShowDateList] =
  useState<DateListType>(null);
  const handlePeriodChange = (
    period: AnalyticsPeriod
  ) => {
    onFilterChange({
      ...filter,
      period,
      date:
        period === 'week'
          ? filter.date || new Date().toISOString().slice(0, 10)
          : filter.date,
      month:
        period === 'month'
          ? filter.month === 'all'
            ? new Date().getMonth() + 1
            : filter.month
          : filter.month,
      year:
        period === 'month' || period === 'year'
          ? filter.year === 'all'
            ? new Date().getFullYear()
            : filter.year
          : filter.year,
    });
  };

  const hasData =
    analytics.totalDays > 0 ||
    analytics.penaltyCount > 0;

  return (
    <div className="animate-in fade-in">

      {/* HEADER */}

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Users className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">
              Employee Analytics
            </h2>
            <p className="text-sm text-slate-400">
              Attendance, timing and penalty performance
            </p>
          </div>
        </div>
      </div>

      {/* FILTERS */}

      <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">

          {/* EMPLOYEE */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">
              Employee
            </label>

            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <select
                value={selectedName}
                onChange={event =>
                  onNameChange(event.target.value)
                }
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-10 py-2.5 text-white outline-none focus:border-primary"
              >
                {normalizedNames.length === 0 && (
  <option value="">
    No employees
  </option>
)}

{normalizedNames.map(name => (
  <option key={name} value={name}>
    {name}
  </option>
))}
              </select>
            </div>
          </div>

          {/* PERIOD */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">
              Period
            </label>

            <select
              value={filter.period}
              onChange={event =>
                handlePeriodChange(
                  event.target.value as AnalyticsPeriod
                )
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-primary"
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="overall">Overall</option>
            </select>
          </div>

          {/* WEEK */}

          {filter.period === 'week' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-400">
                Select Date
              </label>

              <input
                type="date"
                value={filter.date}
                onChange={event =>
                  onFilterChange({
                    ...filter,
                    date: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-primary"
              />
            </div>
          )}

          {/* MONTH */}

          {filter.period === 'month' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-400">
                Month
              </label>

              <select
                value={filter.month}
                onChange={event =>
                  onFilterChange({
                    ...filter,
                    month: Number(event.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-primary"
              >
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
          )}

          {/* YEAR */}

          {(filter.period === 'month' ||
            filter.period === 'year') && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-400">
                Year
              </label>

              <select
                value={filter.year}
                onChange={event =>
                  onFilterChange({
                    ...filter,
                    year: Number(event.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-primary"
              >
                {years.length === 0 && (
                  <option value={new Date().getFullYear()}>
                    {new Date().getFullYear()}
                  </option>
                )}

                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* PERIOD INFO */}

          <div className="flex items-end">
            <div className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />

              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  Selected Period
                </p>

                <p className="truncate text-sm font-medium text-white">
                  {analytics.periodLabel}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {!selectedName ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 py-12 text-center text-slate-400">
          Select an employee to view analytics.
        </div>
      ) : !hasData ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 py-12 text-center">
          <div className="mx-auto mb-3 w-fit rounded-full bg-slate-700/60 p-3">
            <Users className="h-6 w-6 text-slate-400" />
          </div>

          <p className="font-medium text-white">
            No analytics data found
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {selectedName} has no records in the selected period.
          </p>
        </div>
      ) : (
        <>
          {/* ATTENDANCE */}

          <section className="mb-6">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-white">
                Attendance Statistics
              </h3>

              <p className="text-sm text-slate-500">
                Attendance status for the selected period
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
             <StatCard
  icon={<CalendarDays className="h-5 w-5" />}
  label="Present"
  value={analytics.presentDays}
  description="Attendance days"
/>

<button
  type="button"
  onClick={() => setShowDateList('weekOff')}
  className="w-full rounded-xl text-left transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-primary/50"
>
  <StatCard
    icon={<CalendarDays className="h-5 w-5" />}
    label="Week Off"
    value={analytics.weekOffDays}
    description="Click to view dates"
  />
</button>

<button
  type="button"
  onClick={() => setShowDateList('permission')}
  className="w-full rounded-xl text-left transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-primary/50"
>
  <StatCard
    icon={<CalendarDays className="h-5 w-5" />}
    label="Permission"
    value={analytics.permissionDays}
    description="Click to view dates"
  />
</button>

<button
  type="button"
  onClick={() => setShowDateList('halfDay')}
  className="w-full rounded-xl text-left transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-primary/50"
>
  <StatCard
    icon={<CalendarDays className="h-5 w-5" />}
    label="Half Day"
    value={analytics.halfDays}
    description="Click to view dates"
  />
</button>
            </div>
          </section>

          {/* TIME */}

          <section className="mb-6">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-white">
                Time Statistics
              </h3>

              <p className="text-sm text-slate-500">
                Average timing calculated from available valid records
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard
                icon={<Clock3 className="h-5 w-5" />}
                label="Average Check-in"
                value={analytics.avgCheckIn}
              />

              <StatCard
                icon={<Clock3 className="h-5 w-5" />}
                label="Average Check-out"
                value={analytics.avgCheckOut}
              />

              <StatCard
                icon={<Clock3 className="h-5 w-5" />}
                label="Average Working Hours"
                value={analytics.avgWorkingHours}
              />
            </div>
          </section>

          {/* PENALTY */}

          <section>
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-white">
                Penalty Statistics
              </h3>

              <p className="text-sm text-slate-500">
                Penalty performance for the selected period
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Penalty Count"
                value={analytics.penaltyCount}
                description="Penalty records"
              />

              <StatCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Total Penalty"
                value={formatCurrency(
                  analytics.totalPenalty
                )}
              />

              <StatCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Average Penalty"
                value={formatCurrency(
                  analytics.avgPenalty
                )}
              />
            </div>
          </section>
        </>
      )}
      {showDateList && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onClick={() => setShowDateList(null)}
  >
    <div
      className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      onClick={event => event.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {showDateList === 'weekOff'
              ? 'Week Off Dates'
              : showDateList === 'permission'
              ? 'Permission Dates'
              : 'Half Day Dates'}
          </h3>

          <p className="text-sm text-slate-500">
            {analytics.periodLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDateList(null)}
          className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          ✕
        </button>
      </div>

      {showDateList === 'permission' ? (
        analytics.permissionDetails.length === 0 ? (
          <div className="rounded-lg bg-slate-800 p-4 text-center text-sm text-slate-400">
            No permission dates found.
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {analytics.permissionDetails.map(
              permission => {
                const dateObject =
                  new Date(
                    `${permission.date}T00:00:00`
                  );

                const formattedDate =
                  dateObject.toLocaleDateString(
                    'en-GB',
                    {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }
                  );

                const dayName =
                  dateObject.toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                    }
                  );

                return (
                  <div
                    key={`${permission.date}-${permission.rawText}`}
                    className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {formattedDate}
                        </p>

                        <p className="text-sm text-slate-400">
                          {dayName}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-right">
                        <p className="text-xs text-slate-500">
                          Permission
                        </p>

                        <p className="font-semibold text-primary">
                          {permission.displayDuration ||
                            'Duration unknown'}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 truncate text-xs text-slate-500">
                      {permission.rawText}
                    </p>
                  </div>
                );
              }
            )}
          </div>
        )
      ) : (
        (() => {
          const dates =
            showDateList === 'weekOff'
              ? analytics.weekOffDates
              : analytics.halfDayDates;

          return dates.length === 0 ? (
            <div className="rounded-lg bg-slate-800 p-4 text-center text-sm text-slate-400">
              No dates found.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {dates.map(date => {
                const dateObject =
                  new Date(`${date}T00:00:00`);

                const formattedDate =
                  dateObject.toLocaleDateString(
                    'en-GB',
                    {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }
                  );

                const dayName =
                  dateObject.toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                    }
                  );

                return (
                  <div
                    key={date}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3"
                  >
                    <span className="font-medium text-white">
                      {formattedDate}
                    </span>

                    <span className="text-sm text-slate-400">
                      {dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      <div className="mt-4 border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Total
          </p>

          <p className="font-semibold text-white">
            {showDateList === 'weekOff'
              ? `${analytics.weekOffDates.length} days`
              : showDateList === 'permission'
              ? `${analytics.permissionDetails.length} permissions`
              : `${analytics.halfDayDates.length} days`}
          </p>
        </div>

        {showDateList === 'permission' &&
          analytics.totalPermissionMinutes != null && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Total Permission
              </p>

              <p className="font-semibold text-primary">
                {analytics.totalPermissionDuration}
              </p>
            </div>
          )}
      </div>
    </div>
  </div>
)}
    </div>
  );
}