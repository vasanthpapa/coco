 export interface AttendanceRecord {
  name: string;
  empId?: string;
  checkIn: string;
  checkOut: string;
  checkIns: string[];
  checkOuts: string[];
  halfDay: string;
  permission: string;
  weekOff: string;
  date?: string;
}

export interface NameMapping {
  id: number;
  empId: string;
  employeeName: string;
  aliases: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type EmployeeNameMap = Record<string, string>;

const DEFAULT_EMPLOYEES = [
  'Arunkumar',
  'Bhuvaneswaran',
  'Devesh',
  'Naresh',
  'Shruthi',
  'Tamilarasan',
  'Vasanth',
  'Vishnukumar',
  'Vishnupriya',
  'GUNASRI',
  'Ezhilarasan',
  'PRIYADHARSHINI',
  'Kalaivani',
  'Gokul',
  'Sivasankari',
  'Rajasekaran',
  'Meena',
  'JAYAMALA',
  'Girija',
  'Prathap',
  'Thilak',
  'Prabakaran',
  'Mohandass',
  'Gopinath',
  'Sarala',
  'AVINESH',
  'Sanjay',
  'Logeshwaran',
  'Sireesha',
];

export const CUSTOM_NAME_ORDER: string[] = [...DEFAULT_EMPLOYEES];

function cleanName(name: string): string {
  return String(name || '').trim();
}

function lowerName(name: string): string {
  return cleanName(name).toLowerCase();
}

function normalizeNameForComparison(name: string): string {
  return lowerName(name).replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (!a.length) {
    return b.length;
  }

  if (!b.length) {
    return a.length;
  }

  const previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const insertCost = current[j - 1] + 1;
      const deleteCost = previous[j] + 1;
      const replaceCost =
        previous[j - 1] +
        (a[i - 1] === b[j - 1] ? 0 : 1);

      current[j] = Math.min(
        insertCost,
        deleteCost,
        replaceCost
      );
    }

    for (let j = 0; j < current.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

export interface NameResolver {
  resolve: (name: string) => string;
  resolveOriginal: (name: string) => string;
  isKnown: (name: string) => boolean;
}

export function createNameResolver(
  allNames: string[],
  mappings: NameMapping[]
): NameResolver {
  const aliasMap = new Map<string, string>();
  const exactNameMap = new Map<string, string>();
  const fuzzyCandidates: {
    name: string;
    normalized: string;
  }[] = [];
  const fuzzyCache = new Map<string, string>();
  const knownNameKeys = new Set<string>();

  for (const mapping of mappings) {
    const employeeName = cleanName(mapping.employeeName);

    for (const alias of mapping.aliases || []) {
      const cleanAlias = cleanName(alias);

      if (!cleanAlias) {
        continue;
      }

      const key = cleanAlias.toLowerCase();

      if (!aliasMap.has(key)) {
        aliasMap.set(key, employeeName);
      }
    }
  }

  for (const name of allNames) {
    const clean = cleanName(name);

    if (!clean) {
      continue;
    }

    const key = clean.toLowerCase();

    if (!exactNameMap.has(key)) {
      exactNameMap.set(key, clean);
    }

    knownNameKeys.add(
      normalizeNameForComparison(clean)
    );
  }

  const candidateSet = new Set<string>();

  for (const name of CUSTOM_NAME_ORDER) {
    const clean = cleanName(name);

    if (clean && !candidateSet.has(clean)) {
      candidateSet.add(clean);

      fuzzyCandidates.push({
        name: clean,
        normalized: normalizeNameForComparison(clean),
      });
    }
  }

  for (const mapping of mappings) {
    const clean = cleanName(mapping.employeeName);

    if (clean && !candidateSet.has(clean)) {
      candidateSet.add(clean);

      fuzzyCandidates.push({
        name: clean,
        normalized: normalizeNameForComparison(clean),
      });
    }
  }

  const resolve = (name: string): string => {
    const clean = cleanName(name);

    if (!clean) {
      return '';
    }

    const lower = clean.toLowerCase();

    const mappedName = aliasMap.get(lower);

    if (mappedName !== undefined) {
      return mappedName;
    }

    const exactName = exactNameMap.get(lower);

    if (exactName !== undefined) {
      return exactName;
    }

    const normalizedInput =
      normalizeNameForComparison(clean);

    if (!normalizedInput) {
      return clean;
    }

    const cached = fuzzyCache.get(normalizedInput);

    if (cached !== undefined) {
      return cached;
    }

    let bestMatch = '';
    let bestScore = 0;
    let secondBestScore = 0;

    for (const candidate of fuzzyCandidates) {
      const candidateNormalized = candidate.normalized;

      if (!candidateNormalized) {
        continue;
      }

      let score: number;

      if (normalizedInput === candidateNormalized) {
        score = 1;
      } else {
        const distance = levenshteinDistance(
          normalizedInput,
          candidateNormalized
        );

        score =
          1 -
          distance /
            Math.max(
              normalizedInput.length,
              candidateNormalized.length
            );
      }

      if (score > bestScore) {
        secondBestScore = bestScore;
        bestScore = score;
        bestMatch = candidate.name;
      } else if (score > secondBestScore) {
        secondBestScore = score;
      }
    }

    const cleanLength = normalizedInput.length;

    const threshold =
      cleanLength <= 4
        ? 0.9
        : cleanLength <= 6
          ? 0.84
          : 0.78;

    const isAmbiguous =
      bestScore - secondBestScore < 0.05;

    const result =
      bestMatch &&
      bestScore >= threshold &&
      !isAmbiguous
        ? bestMatch
        : clean;

    fuzzyCache.set(normalizedInput, result);

    return result;
  };

  const resolveOriginal = (name: string): string => {
    const clean = cleanName(name);

    if (!clean) {
      return '';
    }

    return (
      aliasMap.get(clean.toLowerCase()) ||
      clean
    );
  };

  const isKnown = (name: string): boolean => {
    const clean = cleanName(name);

    if (!clean) {
      return false;
    }

    const normalized = resolve(clean);

    if (!normalized) {
      return false;
    }

    const normalizedKey =
      normalizeNameForComparison(normalized);

    if (!normalizedKey) {
      return false;
    }

    return knownNameKeys.has(normalizedKey);
  };

  return {
    resolve,
    resolveOriginal,
    isKnown,
  };
}

export function getEmployeeNameMap(
  mappings: NameMapping[] = []
): EmployeeNameMap {
  const map: EmployeeNameMap = {};

  for (const mapping of mappings) {
    for (const alias of mapping.aliases || []) {
      const cleanAlias = cleanName(alias);

      if (cleanAlias) {
        map[cleanAlias] = mapping.employeeName;
      }
    }
  }

  return map;
}

export function resolveOriginalEmployeeName(
  name: string,
  mappings: NameMapping[] = []
): string {
  const clean = cleanName(name);

  if (!clean) {
    return '';
  }

  const lower = clean.toLowerCase();

  for (const mapping of mappings) {
    for (const alias of mapping.aliases || []) {
      if (
        cleanName(alias).toLowerCase() ===
        lower
      ) {
        return mapping.employeeName;
      }
    }
  }

  return clean;
}

export function normalizeEmployeeName(
  name: string,
  allNames: string[] = CUSTOM_NAME_ORDER,
  mappings: NameMapping[] = []
): string {
  return createNameResolver(
    allNames,
    mappings
  ).resolve(name);
}

export function normalizeAttendanceSenderName(
  sender: string,
  allNames: string[],
  mappings: NameMapping[] = [],
  resolver?: NameResolver
): string {
  const cleanSender = cleanName(sender);

  if (!cleanSender) {
    return '';
  }

  const lowerSender = cleanSender.toLowerCase();

  for (const name of allNames) {
    const cleanNameValue = cleanName(name);

    if (
      cleanNameValue &&
      cleanNameValue.toLowerCase() === lowerSender
    ) {
      return cleanNameValue;
    }
  }

  return (
    resolver ||
    createNameResolver(allNames, mappings)
  ).resolve(cleanSender);
}

export function sortByName(
  a: { name: string },
  b: { name: string },
  employeeOrder: string[] = CUSTOM_NAME_ORDER
): number {
  const nameA = lowerName(a.name);
  const nameB = lowerName(b.name);

  let indexA = -1;
  let indexB = -1;

  for (let i = 0; i < employeeOrder.length; i++) {
    const current = lowerName(employeeOrder[i]);

    if (indexA === -1 && current === nameA) {
      indexA = i;
    }

    if (indexB === -1 && current === nameB) {
      indexB = i;
    }

    if (
      indexA !== -1 &&
      indexB !== -1
    ) {
      break;
    }
  }

  if (
    indexA !== -1 &&
    indexB !== -1
  ) {
    return indexA - indexB;
  }

  if (indexA !== -1) {
    return -1;
  }

  if (indexB !== -1) {
    return 1;
  }

  return a.name.localeCompare(
    b.name,
    undefined,
    { sensitivity: 'base' }
  );
}

export function getAppliesToNames(
  msg: Record<string, any>,
  allNames: string[],
  mappings: NameMapping[] = [],
  resolver?: NameResolver
): string[] {
  if (!msg) {
    return [];
  }

  const sender = cleanName(msg.sender);
  const message = String(msg.message || '');
  const nameResolver =
    resolver ||
    createNameResolver(allNames, mappings);

  if (!message) {
    return sender
      ? [nameResolver.resolveOriginal(sender)]
      : [];
  }

  const employeeNameMap =
    getEmployeeNameMap(mappings);

  const namesSet = new Set<string>();
  const namesToCheck: string[] = [];

  for (const name of allNames) {
    const clean = cleanName(name);
    if (clean && !namesSet.has(clean)) {
      namesSet.add(clean);
      namesToCheck.push(clean);
    }
  }

  for (const name of Object.keys(employeeNameMap)) {
    const clean = cleanName(name);
    if (clean && !namesSet.has(clean)) {
      namesSet.add(clean);
      namesToCheck.push(clean);
    }
  }

  const mentioned: string[] = [];

  for (const name of namesToCheck) {
    const escapedName = name.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const regex = new RegExp(
      `@?\\b${escapedName}\\b`,
      'i'
    );

    if (regex.test(message)) {
      const resolved =
        nameResolver.resolveOriginal(name);

      if (resolved) {
        mentioned.push(resolved);
      }
    }
  }

  if (mentioned.length === 0) {
    const words = message
      .replace(/@⁨|⁩/g, ' ')
      .replace(/[^A-Za-z0-9._~-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    for (const word of words) {
      const resolved = nameResolver.resolve(word);

      if (
        resolved &&
        nameResolver.isKnown(resolved) &&
        !mentioned.includes(resolved)
      ) {
        mentioned.push(resolved);
      }
    }
  }

  if (mentioned.length > 0) {
    return [
      ...new Set(
        mentioned.filter(Boolean)
      ),
    ];
  }

  return sender
    ? [nameResolver.resolveOriginal(sender)]
    : [];
}

export function getUniqueDates(
  data: Record<string, any>[]
): string[] {
  const dateSet = new Set<string>();

  for (const row of data) {
    const date = cleanName(row?.date);

    if (date) {
      dateSet.add(date);
    }
  }

  return Array.from(dateSet).sort(
    (a, b) =>
      convertRawDateToISO(b).localeCompare(
        convertRawDateToISO(a)
      )
  );
}

export function getUniqueNames(
  data: Record<string, any>[],
  mappings: NameMapping[] = []
): string[] {
  const allNames = [
    ...CUSTOM_NAME_ORDER,
    ...mappings.map(
      mapping => mapping.employeeName
    ),
  ];

  const resolver = createNameResolver(
    allNames,
    mappings
  );

  const normalizedNames =
    new Set<string>();

  for (const row of data) {
    const sender = cleanName(row?.sender);

    if (sender) {
      normalizedNames.add(
        resolver.resolve(sender)
      );
    }
  }

  return Array.from(
    normalizedNames
  ).sort(
    (a, b) =>
      sortByName(
        { name: a },
        { name: b }
      )
  );
}

export function convertRawDateToISO(
  rawDate: string
): string {
  if (!rawDate) {
    return '';
  }

  const value = String(rawDate).trim();

  if (!value) {
    return '';
  }

  let year: number;
  let month: number;
  let day: number;

  let match = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = value.match(
      /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/
    );

    if (!match) {
      return '';
    }

    const first = Number(match[1]);
    const second = Number(match[2]);
    const yearValue = match[3];

    year =
      yearValue.length === 2
        ? 2000 + Number(yearValue)
        : Number(yearValue);

    // Unambiguous DD/MM
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    }
    // Unambiguous MM/DD
    else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    }
    // Existing WhatsApp/source behaviour:
    // ambiguous dates remain MM/DD.
    else {
      month = first;
      day = second;
    }
  }

  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return '';
  }

  const isoDate =
    `${String(year).padStart(4, '0')}-` +
    `${String(month).padStart(2, '0')}-` +
    `${String(day).padStart(2, '0')}`;

  const date = new Date(
    `${isoDate}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return '';
  }

  return isoDate;
}
export function normalizeDateSequence(
  rawDates: string[]
): string[] {
  if (!rawDates.length) {
    return [];
  }

  const result: string[] = [];
  let previousISO = '';

  for (const rawDate of rawDates) {
    const value = String(rawDate ?? '').trim();

    if (!value) {
      result.push('');
      continue;
    }

    const match = value.match(
      /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/
    );

    if (!match) {
      const iso = convertRawDateToISO(value);
      result.push(iso);

      if (iso) {
        previousISO = iso;
      }

      continue;
    }

    const first = Number(match[1]);
    const second = Number(match[2]);
    const yearValue = match[3];

    const year =
      yearValue.length === 2
        ? 2000 + Number(yearValue)
        : Number(yearValue);

    // Clearly DD/MM
    if (first > 12 && second <= 12) {
      const iso =
        `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;

      result.push(iso);
      previousISO = iso;
      continue;
    }

    // Clearly MM/DD
    if (second > 12 && first <= 12) {
      const iso =
        `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;

      result.push(iso);
      previousISO = iso;
      continue;
    }

    // Ambiguous date:
    // 09/10/2026 can mean:
    // MM/DD -> 2026-09-10
    // DD/MM -> 2026-10-09

    const mmdd =
      `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;

    const ddmm =
      `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;

    if (previousISO) {
      const previousDate = new Date(
        `${previousISO}T00:00:00`
      );

      const mmddDate = new Date(
        `${mmdd}T00:00:00`
      );

      const ddmmDate = new Date(
        `${ddmm}T00:00:00`
      );

      const mmddDiff =
        mmddDate.getTime() -
        previousDate.getTime();

      const ddmmDiff =
        ddmmDate.getTime() -
        previousDate.getTime();

      // Prefer the interpretation that continues
      // naturally from the previous date.
      if (
        mmddDiff >= 0 &&
        mmddDiff <= 31 * 24 * 60 * 60 * 1000 &&
        (
          ddmmDiff < 0 ||
          mmddDiff <= ddmmDiff
        )
      ) {
        result.push(mmdd);
        previousISO = mmdd;
        continue;
      }

      if (
        ddmmDiff >= 0 &&
        ddmmDiff <= 31 * 24 * 60 * 60 * 1000
      ) {
        result.push(ddmm);
        previousISO = ddmm;
        continue;
      }
    }

    // Fallback to existing source behaviour.
    result.push(mmdd);
    previousISO = mmdd;
  }

  return result;
}

export function formatDateDDMMYY(
  rawDate: string
): string {
  if (!rawDate) {
    return '';
  }

  const isoDate = convertRawDateToISO(rawDate);

  if (!isoDate) {
    return rawDate;
  }

  const date = new Date(
    `${isoDate}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date);
}

export interface PermissionDetail {
  date: string;
  durationMinutes: number | null;
  displayDuration: string;
  rawText: string;
}

function formatPermissionDuration(
  minutes: number
): string {
  if (minutes <= 0) {
    return '';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  if (hours === 0) {
    return `${remainingMinutes} ${
      remainingMinutes === 1 ? 'minute' : 'minutes'
    }`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function parsePermissionDuration(
  text: string
): {
  durationMinutes: number | null;
  displayDuration: string;
} {
  const cleanText = String(text || '')
    .trim()
    .toLowerCase();

  if (!cleanText) {
    return {
      durationMinutes: null,
      displayDuration: '',
    };
  }

  // 11am-2pm / 11 am - 2 pm / 11am to 2pm
  const timeRangeWithAmPm = cleanText.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/
  );

  if (timeRangeWithAmPm) {
    const startHour = Number(timeRangeWithAmPm[1]);
    const startMinute = Number(
      timeRangeWithAmPm[2] || 0
    );
    const startPeriod = timeRangeWithAmPm[3];

    const endHour = Number(timeRangeWithAmPm[4]);
    const endMinute = Number(
      timeRangeWithAmPm[5] || 0
    );
    const endPeriod = timeRangeWithAmPm[6];

    const start = timeToMinutes(
      `${startHour}:${String(startMinute).padStart(2, '0')} ${startPeriod}`
    );

    const end = timeToMinutes(
      `${endHour}:${String(endMinute).padStart(2, '0')} ${endPeriod}`
    );

    if (start >= 0 && end >= 0) {
      let duration = end - start;

      if (duration < 0) {
        duration += 24 * 60;
      }

      if (duration > 0) {
        return {
          durationMinutes: duration,
          displayDuration:
            formatPermissionDuration(duration),
        };
      }
    }
  }

  // 11-2 / 11 - 2 / 11 to 2
  const numericTimeRange = cleanText.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\b/
  );

  if (numericTimeRange) {
    const startHour = Number(numericTimeRange[1]);
    const startMinute = Number(
      numericTimeRange[2] || 0
    );

    const endHour = Number(numericTimeRange[3]);
    const endMinute = Number(
      numericTimeRange[4] || 0
    );

    if (
      startHour <= 23 &&
      endHour <= 23 &&
      startMinute <= 59 &&
      endMinute <= 59
    ) {
      let duration =
        endHour * 60 +
        endMinute -
        (startHour * 60 + startMinute);

      if (duration < 0) {
        duration += 12 * 60;
      }

      if (duration > 0) {
        return {
          durationMinutes: duration,
          displayDuration:
            formatPermissionDuration(duration),
        };
      }
    }
  }

  // 1 hour / 1 hours / 1 hr / 1 hrs / 1hour
  const hourMatch = cleanText.match(
  /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/
);

  if (hourMatch) {
    const hours = Number(hourMatch[1]);

    if (
      Number.isFinite(hours) &&
      hours > 0
    ) {
      const minutes = Math.round(hours * 60);

      return {
        durationMinutes: minutes,
        displayDuration:
          formatPermissionDuration(minutes),
      };
    }
  }

  // 30 minutes / 30 mins / 30 min / 30minutes
 const minuteMatch = cleanText.match(
  /(\d+)\s*(?:minutes?|mins?|min)\b/
);

  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);

    if (
      Number.isFinite(minutes) &&
      minutes > 0
    ) {
      return {
        durationMinutes: minutes,
        displayDuration:
          formatPermissionDuration(minutes),
      };
    }
  }

  return {
    durationMinutes: null,
    displayDuration: '',
  };
}


export function timeToMinutes(
  timeStr: string
): number {
  if (!timeStr) {
    return -1;
  }

  const cleanTime =
    String(timeStr)
      .trim()
      .toLowerCase();

  const match =
    cleanTime.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(am|pm))?$/
    );

  if (!match) {
    return -1;
  }

  let hours =
    parseInt(match[1], 10);

  const minutes =
    parseInt(match[2], 10);

  const ampm = match[4];

  if (
    minutes < 0 ||
    minutes > 59
  ) {
    return -1;
  }

  if (
    ampm &&
    (hours < 1 || hours > 12)
  ) {
    return -1;
  }

  if (
    !ampm &&
    (hours < 0 || hours > 23)
  ) {
    return -1;
  }

  if (
    ampm === 'pm' &&
    hours < 12
  ) {
    hours += 12;
  }

  if (
    ampm === 'am' &&
    hours === 12
  ) {
    hours = 0;
  }

  return hours * 60 + minutes;
}
