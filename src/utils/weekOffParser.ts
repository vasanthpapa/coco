import {
  CUSTOM_NAME_ORDER,
  normalizeEmployeeName,
  sortByName,
} from './attendanceUtils';

import {
  getAppliesToNames,
} from './messageUtils';

export interface WeekOffRecord {
  name: string;
  date: string;
  weekOff: string;
}

export function parseWeekOff(
  data: Record<string, any>[],
  targetDate?: string
): WeekOffRecord[] {
  const filteredData = targetDate
    ? data.filter(
        row => row.date === targetDate
      )
    : data;

  const allNames = Array.from(
    new Set([
      ...CUSTOM_NAME_ORDER,
      ...data
        .map(row => row.sender)
        .filter(Boolean),
    ])
  );

  const records: Record<
    string,
    WeekOffRecord
  > = {};

  filteredData.forEach(msg => {
    if (
      !msg.sender ||
      !msg.message
    ) {
      return;
    }

    const text = String(
      msg.message
    ).toLowerCase();

    const isWeekOff =
      text.includes('week off') ||
      text.includes('weekoff') ||
      text.includes('weekly off') ||
      text === 'wo';

    if (!isWeekOff) {
      return;
    }

    const appliesTo =
      getAppliesToNames(
        msg,
        allNames
      );

    appliesTo.forEach(
      targetName => {
        const name =
          normalizeEmployeeName(
            targetName,
            allNames
          );

        const date =
          msg.date ||
          targetDate ||
          '';

        const key =
          `${name}-${date}`;

        records[key] = {
          name,
          date,
          weekOff: 'Yes',
        };
      }
    );
  });

  return Object.values(
    records
  ).sort(sortByName);
}