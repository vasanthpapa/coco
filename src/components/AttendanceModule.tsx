import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  UserCheck,
  Clock3,
  ShieldCheck,
  CalendarOff,
  CalendarDays,
} from 'lucide-react';

import {
  convertRawDateToISO,
  resolveOriginalEmployeeName,
} from '../utils/attendanceUtils';

import type {
  AttendanceRecord,
} from '../utils/attendanceUtils';
import {
  loadEmployeeRecords,
  loadEmployeeNameMappings,
} from '../utils/employeeApi';
import type {
  EmployeeRecord,
  NameMapping,
} from '../utils/employeeApi';

interface AttendanceModuleProps {
  attendanceData: AttendanceRecord[];
}
function formatAttendanceTimes(
  times?: string[],
  fallback?: string
): string[] {
  if (Array.isArray(times) && times.length > 0) {
    return times.filter(
      time => Boolean(time && time !== '-')
    );
  }

  if (fallback && fallback !== '-') {
    return [fallback];
  }

  return [];
}
export default function AttendanceModule({
  attendanceData,
}: AttendanceModuleProps) {
  const dates = useMemo(() => {
  const dateSet = new Set<string>();

  attendanceData.forEach(record => {
    const isoDate = record.date
      ? convertRawDateToISO(record.date)
      : '';

    if (isoDate) {
      dateSet.add(isoDate);
    }
  });

  return Array.from(dateSet).sort(
    (a, b) => b.localeCompare(a)
  );
}, [attendanceData]);

  const [selectedDateISO, setSelectedDateISO] =
    useState('');
const [employeeRecords, setEmployeeRecords] = useState<EmployeeRecord[]>([]);
const [nameMappings, setNameMappings] = useState<NameMapping[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
  const [mappingVersion, setMappingVersion] = useState(0);
useEffect(() => {
  const loadEmployeeData = async () => {
    const [employees, mappings] = await Promise.all([
      loadEmployeeRecords(),
      loadEmployeeNameMappings(),
    ]);

    setEmployeeRecords(employees);
    setNameMappings(mappings);
  };

  loadEmployeeData();
}, [mappingVersion]);
 

  useEffect(() => {
    const handleMappingUpdate = () => {
      setMappingVersion(version => version + 1);
    };

    window.addEventListener(
      'employee-mapping-updated',
      handleMappingUpdate
    );

    return () => {
      window.removeEventListener(
        'employee-mapping-updated',
        handleMappingUpdate
      );
    };
  }, []);

  useEffect(() => {
    if (
      dates.length > 0 &&
      !selectedDateISO
    ) {
      setSelectedDateISO(dates[0]);
    }
  }, [
    dates,
    selectedDateISO,
  ]);

  useEffect(() => {
    if (
  dates.length > 0 &&
  selectedDateISO &&
  !dates.includes(selectedDateISO)
) {
  setSelectedDateISO(dates[0]);
}
  }, [
    dates,
    selectedDateISO,
  ]);


  const selectedDateIndex = useMemo(() => {
  return dates.findIndex(
    date => date === selectedDateISO
  );
}, [
  dates,
  selectedDateISO,
]);

  const goToPreviousDate = () => {
    if (
      selectedDateIndex >= 0 &&
      selectedDateIndex < dates.length - 1
    ) {
      setSelectedDateISO(
  dates[selectedDateIndex + 1]
);
    }
  };

  const goToNextDate = () => {
    if (selectedDateIndex > 0) {
      setSelectedDateISO(
  dates[selectedDateIndex - 1]
);
    }
  };

 const formattedSelectedDate = useMemo(() => {
  if (!selectedDateISO) {
    return '';
  }

  const date = new Date(`${selectedDateISO}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}, [selectedDateISO]);

 const selectedWeekday = useMemo(() => {
  if (!selectedDateISO) {
    return '';
  }

  const date = new Date(`${selectedDateISO}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
  }).format(date);
}, [selectedDateISO]);
  const selectedMonthKey = useMemo(() => {
    if (!selectedDateISO) {
      return '';
    }

    return selectedDateISO.slice(0, 7);
  }, [selectedDateISO]);

const availableMonths = useMemo(() => {
  const monthSet = new Set<string>();

  dates.forEach(date => {
    if (date) {
      monthSet.add(date.slice(0, 7));
    }
  });

  return Array.from(monthSet).sort(
    (a, b) =>
      b.localeCompare(a)
  );
}, [dates]);

  const selectedMonthIndex = useMemo(() => {
    return availableMonths.findIndex(
      month =>
        month === selectedMonthKey
    );
  }, [
    availableMonths,
    selectedMonthKey,
  ]);

const formattedSelectedMonth = useMemo(() => {
  if (!selectedMonthKey) {
    return '';
  }

  const date = new Date(
    `${selectedMonthKey}-01T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}, [selectedMonthKey]);

  const goToPreviousMonth = () => {
    if (
      selectedMonthIndex >= 0 &&
      selectedMonthIndex <
        availableMonths.length - 1
    ) {
      const previousMonth =
        availableMonths[
          selectedMonthIndex + 1
        ];

      const firstDateOfMonth =
  dates.find(date =>
    date.startsWith(previousMonth)
  );

      if (firstDateOfMonth) {
       setSelectedDateISO(
  firstDateOfMonth
);
      }
    }
  };

const goToNextMonth = () => {
  if (selectedMonthIndex > 0) {
    const nextMonth =
      availableMonths[selectedMonthIndex - 1];

    const firstDateOfMonth =
      dates.find(date =>
        date.startsWith(nextMonth)
      );

    if (firstDateOfMonth) {
      setSelectedDateISO(
        firstDateOfMonth
      );
    }
  }
};

const dateAttendance = useMemo(() => {
  if (!selectedDateISO) {
    return [];
  }

  const selectedDateRecords = attendanceData.filter(
    record =>
      convertRawDateToISO(record.date || '') ===
      selectedDateISO
  );

  const getEmployeeForName = (
    name: string
  ): EmployeeRecord | undefined => {
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return undefined;
    }

    const lowerName = cleanName.toLowerCase();

    // Check alias mapping first.
    const mapping = nameMappings.find(mapping =>
      mapping.aliases?.some(
        alias =>
          String(alias || '').trim().toLowerCase() ===
          lowerName
      )
    );

    // Mapping empId is the stable employee identity.
    if (mapping?.empId) {
      const employeeByEmpId = employeeRecords.find(
        employee =>
          employee.empId.trim().toLowerCase() ===
          mapping.empId.trim().toLowerCase()
      );

      if (employeeByEmpId) {
        return employeeByEmpId;
      }
    }

    // Direct employee name match.
    return employeeRecords.find(
      employee =>
        employee.employeeName.trim().toLowerCase() ===
        lowerName
    );
  };

  const getEmployeeForRecord = (
    record: AttendanceRecord
  ): EmployeeRecord | undefined => {
    // 1. Emp ID is the strongest identity match.
    if (record.empId?.trim()) {
      const employeeByEmpId =
        employeeRecords.find(
          employee =>
            employee.empId.trim().toLowerCase() ===
            record.empId!.trim().toLowerCase()
        );

      if (employeeByEmpId) {
        return employeeByEmpId;
      }
    }

    // 2. Fall back to name / alias mapping.
    return getEmployeeForName(record.name);
  };

  const attendanceByEmployeeId =
    new Map<string, AttendanceRecord>();

  const attendanceByEmployeeName =
    new Map<string, AttendanceRecord>();

  const matchedRecords =
    new Set<AttendanceRecord>();

  selectedDateRecords.forEach(record => {
    const employee =
      getEmployeeForRecord(record);

    if (employee) {
      matchedRecords.add(record);

      attendanceByEmployeeId.set(
        employee.empId.trim().toLowerCase(),
        record
      );
    }

    const resolvedName =
      employee?.employeeName ||
      resolveOriginalEmployeeName(
        record.name,
        nameMappings
      );

    if (resolvedName) {
      attendanceByEmployeeName.set(
        resolvedName.trim().toLowerCase(),
        record
      );
    }
  });

  // Build the table from employee master.
  // Employees without attendance still get a "-" row.
  const employeeAttendance =
    employeeRecords
      .filter(employee => employee.active)
      .map(employee => {
        const employeeIdKey =
          employee.empId.trim().toLowerCase();

        const employeeNameKey =
          employee.employeeName.trim().toLowerCase();

        const attendance =
          attendanceByEmployeeId.get(
            employeeIdKey
          ) ||
          attendanceByEmployeeName.get(
            employeeNameKey
          );

        if (attendance) {
          return {
            ...attendance,
            name: employee.employeeName,
            empId: employee.empId,
          };
        }

        return {
          name: employee.employeeName,
          empId: employee.empId,
          checkIn: '-',
          checkOut: '-',
          checkIns: [],
          checkOuts: [],
          halfDay: '-',
          permission: '-',
          weekOff: '-',
          date: selectedDateISO,
        };
      });

  // Never hide successfully parsed attendance just because the hosted
  // employee master is empty, unavailable, or does not contain that sender.
  const unmatchedAttendance =
    selectedDateRecords
      .filter(record => !matchedRecords.has(record))
      .map(record => ({
        ...record,
        name:
          resolveOriginalEmployeeName(
            record.name,
            nameMappings
          ) || record.name,
      }));

  const mergedAttendance = [
    ...employeeAttendance,
    ...unmatchedAttendance,
  ];

  return mergedAttendance.sort((a, b) => {
    const empIdA = String(a.empId || '');
    const empIdB = String(b.empId || '');

    if (!empIdA && !empIdB) {
      return a.name.localeCompare(
        b.name,
        undefined,
        {
          sensitivity: 'base',
        }
      );
    }

    if (!empIdA) {
      return 1;
    }

    if (!empIdB) {
      return -1;
    }

    return empIdA.localeCompare(
      empIdB,
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      }
    );
  });
}, [
  attendanceData,
  selectedDateISO,
  employeeRecords,
  nameMappings,
]);

  const dailyAttendance = useMemo(() => {
    const search = searchTerm
      .trim()
      .toLowerCase();

    if (!search) {
      return dateAttendance;
    }

    return dateAttendance.filter(record =>
      record.name
        .toLowerCase()
        .includes(search)
    );
  }, [
    dateAttendance,
    searchTerm,
  ]);

const attendanceSummary = useMemo(() => {
  const employees = new Map<
    string,
    AttendanceRecord
  >();

  dateAttendance.forEach(record => {
    const name = record.name.trim();

    if (!name) {
      return;
    }

    const key = name.toLowerCase();

    if (!employees.has(key)) {
      employees.set(key, record);
    }
  });

  const employeeRecords = Array.from(
    employees.values()
  );

  const total = employeeRecords.length;

  const weekOff = employeeRecords.filter(
    record => record.weekOff === 'Yes'
  ).length;

  const halfDay = employeeRecords.filter(
    record => record.halfDay === 'Yes'
  ).length;

  const permission = employeeRecords.filter(record => {
  const value = String(record.permission || '').trim();

  return value !== '' && value !== '-';
}).length;

  const present = employeeRecords.filter(
    record =>
      record.weekOff !== 'Yes' &&
      (
        (record.checkIns?.length ?? 0) > 0 ||
        Boolean(
          record.checkIn &&
          record.checkIn !== '-'
        ) ||
        (record.checkOuts?.length ?? 0) > 0 ||
        Boolean(
          record.checkOut &&
          record.checkOut !== '-'
        )
      )
  ).length;

  return {
    total,
    present,
    halfDay,
    permission,
    weekOff,
  };
}, [dateAttendance]);

  if (attendanceData.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        No attendance data available.
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        No attendance dates found.
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-6">

      <div className="space-y-5">

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">

          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              Daily Attendance
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Track employee attendance for the selected date
            </p>
          </div>

          <div className="flex flex-col items-center gap-1">

            <div className="flex items-center gap-3">
  {/* DATE PICKER */}
  <div className="relative">
  <CalendarDays
    size={18}
    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
  />

  <input
    type="date"
    value={selectedDateISO}
    max={dates[0] || ''}
    onChange={event =>
      setSelectedDateISO(event.target.value)
    }
    className="h-10 rounded-lg border border-slate-700 bg-slate-800 pl-10 pr-3 text-sm text-white outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary [color-scheme:dark]"
    aria-label="Select attendance date"
  />
</div>

  {/* DATE NAVIGATION */}
  <div className="flex items-center gap-1">

                <button
                  type="button"
                  onClick={goToPreviousDate}
                  disabled={
                    selectedDateIndex ===
                    dates.length - 1
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous date"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="min-w-[190px] text-center">

                  <p className="text-sm font-semibold text-white">
                    {formattedSelectedDate}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={goToNextDate}
                  disabled={
                    selectedDateIndex <= 0
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Next date"
                >
                  <ChevronRight size={20} />
                </button>

              </div>

              <div className="h-6 w-px bg-slate-700" />

              <div className="flex items-center gap-1">

                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  disabled={
                    selectedMonthIndex ===
                    availableMonths.length - 1
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="min-w-[150px] text-center">

                  <p className="text-sm font-semibold text-white">
                    {formattedSelectedMonth}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={goToNextMonth}
                  disabled={
                    selectedMonthIndex <= 0
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Next month"
                >
                  <ChevronRight size={20} />
                </button>

              </div>

            </div>

            <p className="text-xs font-medium text-slate-500">
              {selectedWeekday}
            </p>

          </div>

        </div>

        <div className="relative w-full lg:max-w-sm">

          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            type="text"
            value={searchTerm}
            onChange={event =>
              setSearchTerm(
                event.target.value
              )
            }
            placeholder="Search employee..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          />

        </div>

      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

  {/* Total Employees */}
  <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">
          Total Employees
        </p>
        <p className="mt-2 text-3xl font-bold text-white">
          {attendanceSummary.total}
        </p>
      </div>

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700/70 text-slate-300">
        <Users size={21} />
      </div>
    </div>
  </div>

  {/* Present */}
  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">
          Present
        </p>
        <p className="mt-2 text-3xl font-bold text-emerald-400">
          {attendanceSummary.present}
        </p>
      </div>

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
        <UserCheck size={21} />
      </div>
    </div>
  </div>

  {/* Half Day */}
  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">
          Half Day
        </p>
        <p className="mt-2 text-3xl font-bold text-amber-400">
          {attendanceSummary.halfDay}
        </p>
      </div>

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
        <Clock3 size={21} />
      </div>
    </div>
  </div>

  {/* Permission */}
  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">
          Permission
        </p>
        <p className="mt-2 text-3xl font-bold text-blue-400">
          {attendanceSummary.permission}
        </p>
      </div>

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
        <ShieldCheck size={21} />
      </div>
    </div>
  </div>

  {/* Week Off */}
  <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">
          Week Off
        </p>
        <p className="mt-2 text-3xl font-bold text-violet-400">
          {attendanceSummary.weekOff}
        </p>
      </div>

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
        <CalendarOff size={21} />
      </div>
    </div>
  </div>

</div>

      <div className="overflow-hidden rounded-xl border border-slate-800">

        <div className="attendance-scroll max-h-[500px] overflow-y-auto overflow-x-auto">

          <table className="w-full min-w-[800px] text-left text-sm">

            <thead className="sticky top-0 z-10 border-b border-slate-700 bg-slate-800">

              <tr>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Employee Name
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Check In
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Check Out
                </th>

                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Half Day
                </th>

                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Permission
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
  Week Off
</th>
              </tr>

            </thead>

            <tbody>

              {dailyAttendance.map(
                (row, index) => (
                  <tr
                    key={`${row.name}-${row.date}-${index}`}
                    className="border-b border-slate-800/70 transition-colors last:border-b-0 hover:bg-slate-800/40"
                  >

                    <td className="px-6 py-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                          {row.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <span className="whitespace-nowrap font-semibold text-white">
                          {row.name}
                        </span>

                      </div>

                    </td>

                    <td className="px-6 py-4 font-medium text-emerald-400">
  {formatAttendanceTimes(
    row.checkIns,
    row.checkIn
  ).length > 0 ? (
    <div className="flex flex-col gap-1">
      {formatAttendanceTimes(
        row.checkIns,
        row.checkIn
      ).map((time, timeIndex) => (
        <span key={`${time}-${timeIndex}`}>
          {time}
        </span>
      ))}
    </div>
  ) : (
    '-'
  )}
</td>

                    <td className="px-6 py-4 font-medium text-rose-400">
  {formatAttendanceTimes(
    row.checkOuts,
    row.checkOut
  ).length > 0 ? (
    <div className="flex flex-col gap-1">
      {formatAttendanceTimes(
        row.checkOuts,
        row.checkOut
      ).map((time, timeIndex) => (
        <span key={`${time}-${timeIndex}`}>
          {time}
        </span>
      ))}
    </div>
  ) : (
    '-'
  )}
</td>

                    <td className="px-6 py-4 text-center">

                      {row.halfDay === 'Yes' ? (
                        <span className="inline-flex rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold tracking-wide text-amber-400">
                          HD
                        </span>
                      ) : (
                        <span className="text-slate-600">
                          —
                        </span>
                      )}

                    </td>

                    <td className="px-6 py-4 text-center">

                      {row.permission &&
row.permission !== '-' ? (
                        <span className="inline-flex rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-bold tracking-wide text-blue-400">
                          PERM
                        </span>
                      ) : (
                        <span className="text-slate-600">
                          —
                        </span>
                      )}

                    </td>
<td className="px-6 py-4 text-center">

  {row.weekOff === 'Yes' ? (
    <span className="inline-flex rounded-md bg-violet-500/10 px-2.5 py-1 text-xs font-bold tracking-wide text-violet-400">
      WEEK OFF
    </span>
  ) : (
    <span className="text-slate-600">
      —
    </span>
  )}

</td>
                  </tr>
                )
              )}

              {dailyAttendance.length === 0 && (
                <tr>

                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <Search
                        size={28}
                        className="mb-3 text-slate-600"
                      />

                      <p className="font-medium text-slate-400">
                        {searchTerm
                          ? `No employees found matching "${searchTerm}".`
                          : 'No attendance records found for this date.'}
                      </p>

                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() =>
                            setSearchTerm('')
                          }
                          className="mt-2 text-sm font-medium text-primary hover:underline"
                        >
                          Clear search
                        </button>
                      )}

                    </div>

                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}
