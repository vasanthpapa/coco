import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  convertRawDateToISO,
} from '../utils/attendanceUtils';

import type {
  PenaltyRecord,
} from '../utils/penaltyParser';

import {
  aggregatePenaltyByEmployee,
} from '../utils/reportParser';

import type {
  PeriodFilter,
} from './reports/reportTypes';

import PenaltyReport from './reports/PenaltyReport';

interface PenaltyModuleProps {
  penaltyData: PenaltyRecord[];
}

export default function PenaltyModule({
  penaltyData,
}: PenaltyModuleProps) {
  /*
   * --------------------------------------------------
   * PENALTY FILTER
   * --------------------------------------------------
   */

  const [
    penaltyPeriod,
    setPenaltyPeriod,
  ] = useState<PeriodFilter>({
    month: 'all',
    year: 'all',
    view: 'overall',
  });

  /*
   * --------------------------------------------------
   * EXPLICIT PENALTY DATE
   * --------------------------------------------------
   */

  const [
    selectedPenaltyDate,
    setSelectedPenaltyDate,
  ] = useState('');

  /*
   * --------------------------------------------------
   * AVAILABLE PENALTY YEARS
   * --------------------------------------------------
   */

  const penaltyYears = useMemo(() => {
    const yearSet = new Set<number>();

    penaltyData.forEach(record => {
      if (!record.date) {
        return;
      }

      const isoDate =
        convertRawDateToISO(record.date);

      const parts = isoDate.split('-');

      if (parts.length !== 3) {
        return;
      }

      const year =
        Number(parts[0]);

      if (
        Number.isInteger(year) &&
        year > 0
      ) {
        yearSet.add(year);
      }
    });

    return Array.from(yearSet).sort(
      (a, b) => b - a
    );
  }, [
    penaltyData,
  ]);

  /*
   * --------------------------------------------------
   * AVAILABLE PENALTY DATES
   * --------------------------------------------------
   */

  const penaltyDates = useMemo(() => {
    return Array.from(
      new Set(
        penaltyData
          .map(record => {
            if (!record.date) {
              return '';
            }

            return convertRawDateToISO(
              record.date
            );
          })
          .filter(Boolean)
      )
    ).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [
    penaltyData,
  ]);

  /*
   * --------------------------------------------------
   * DEFAULT / VALID PENALTY DATE
   * --------------------------------------------------
   */

  useEffect(() => {
    if (
      penaltyPeriod.view !== 'explicit' ||
      !selectedPenaltyDate
    ) {
      return;
    }

    const selectedDateParts =
      selectedPenaltyDate.split('-');

    if (
      selectedDateParts.length !== 3
    ) {
      return;
    }

    const selectedYear =
      Number(selectedDateParts[0]);

    const selectedMonth =
      Number(selectedDateParts[1]);

    const yearMatches =
      penaltyPeriod.year === 'all' ||
      selectedYear === penaltyPeriod.year;

    const monthMatches =
      penaltyPeriod.month === 'all' ||
      selectedMonth === penaltyPeriod.month;

    if (
      yearMatches &&
      monthMatches
    ) {
      return;
    }

    /*
     * Find latest available date
     * matching selected month/year.
     */

    const matchingDates =
      penaltyDates.filter(date => {
        const parts = date.split('-');

        if (parts.length !== 3) {
          return false;
        }

        const year =
          Number(parts[0]);

        const month =
          Number(parts[1]);

        const matchesYear =
          penaltyPeriod.year === 'all' ||
          year === penaltyPeriod.year;

        const matchesMonth =
          penaltyPeriod.month === 'all' ||
          month === penaltyPeriod.month;

        return (
          matchesYear &&
          matchesMonth
        );
      });

    if (matchingDates.length > 0) {
      setSelectedPenaltyDate(
        matchingDates[0]
      );
    } else {
      setSelectedPenaltyDate('');
    }
  }, [
    penaltyPeriod.view,
    penaltyPeriod.month,
    penaltyPeriod.year,
    penaltyDates,
    selectedPenaltyDate,
  ]);

  /*
   * --------------------------------------------------
   * OVERALL PENALTY REPORT
   * --------------------------------------------------
   */

  const overallPenaltyData = useMemo(() => {
    return aggregatePenaltyByEmployee(
      penaltyData,
      penaltyPeriod.month,
      penaltyPeriod.year
    );
  }, [
    penaltyData,
    penaltyPeriod.month,
    penaltyPeriod.year,
  ]);

  /*
   * --------------------------------------------------
   * EXPLICIT PENALTY DATA
   * --------------------------------------------------
   */

  const explicitPenaltyData = useMemo(() => {
    if (!Array.isArray(penaltyData)) {
      return [];
    }

    return penaltyData.filter(record => {
      if (!record.date) {
        return false;
      }

      const isoDate =
        convertRawDateToISO(record.date);

      const parts = isoDate.split('-');

      if (parts.length !== 3) {
        return false;
      }

      const recordYear =
        Number(parts[0]);

      const recordMonth =
        Number(parts[1]);

      const yearMatches =
        penaltyPeriod.year === 'all' ||
        recordYear === penaltyPeriod.year;

      const monthMatches =
        penaltyPeriod.month === 'all' ||
        recordMonth === penaltyPeriod.month;

      return (
        yearMatches &&
        monthMatches
      );
    });
  }, [
    penaltyData,
    penaltyPeriod.month,
    penaltyPeriod.year,
  ]);

  /*
   * --------------------------------------------------
   * RENDER
   * --------------------------------------------------
   */

  if (
    !Array.isArray(penaltyData) ||
    penaltyData.length === 0
  ) {
    return (
      <div className="card p-8 text-center text-slate-400">
        No penalty data available.
      </div>
    );
  }
console.log(
  'AK DEBUG',
  penaltyData.filter(record =>
    record.name.trim().toLowerCase()==='Arunkumar'.toLowerCase()
  )
);
  return (
    <PenaltyReport
      overallData={overallPenaltyData}
      explicitData={explicitPenaltyData}
      period={penaltyPeriod}
      onPeriodChange={setPenaltyPeriod}
      years={penaltyYears}
      selectedDate={selectedPenaltyDate}
      onDateChange={setSelectedPenaltyDate}
    />
  );
}