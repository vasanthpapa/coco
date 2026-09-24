import {
  AttendanceRecord,
  CUSTOM_NAME_ORDER,
  createNameResolver,
  sortByName,
  getAppliesToNames,
  normalizeAttendanceSenderName,
  NameMapping,
  NameResolver,
} from './attendanceUtils';

const ATTENDANCE_FILLER_WORDS = new Set([
  'i','iam','am','im','me','my','myself','sir','madam','akka','anna',
  'please','today','now','check','in','out','checkin','checkout',
  'login','logout','full','day','filed','fullday'
]);

function normalizeAttendanceText(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, '');
}

function isSpecificCheckInText(text: string): boolean {
  return normalizeAttendanceText(text).includes('checkin');
}

function isSpecificCheckOutText(text: string): boolean {
  return normalizeAttendanceText(text).includes('checkout');
}

function isWeekOffText(text: string): boolean {
  return /\bweek\s*\*?\s*off\b/i.test(text);
}

function isCheckInText(text: string): boolean {
  const lowerText = text.trim().toLowerCase();
  return (
    lowerText.includes('check in') ||
    lowerText.includes('checkin') ||
    lowerText.includes('login') ||
    lowerText === 'in'
  );
}

function isCheckOutText(text: string): boolean {
  const lowerText = text.trim().toLowerCase();
  return (
    lowerText.includes('check out') ||
    lowerText.includes('checkout') ||
    lowerText.includes('logout') ||
    lowerText === 'out'
  );
}

function isHalfDayText(text: string): boolean {
  const lowerText = text.trim().toLowerCase();
  return (
    lowerText.includes('half day') ||
    /\bhd\b/.test(lowerText)
  );
}

function isPermissionText(text: string): boolean {
  const lowerText = text.trim().toLowerCase();
  return (
    lowerText.includes('permission') ||
    /\bperm\b/.test(lowerText)
  );
}

function cleanPossibleName(value: string): string {
  return value
    .replace(/^[\s:(),.-]+/, '')
    .replace(/[\s:(),.-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isKnownEmployeeName(
  candidate: string,
  resolver: NameResolver
): boolean {
  return resolver.isKnown(
    cleanPossibleName(candidate)
  );
}

function isAttendanceFillerText(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  return ATTENDANCE_FILLER_WORDS.has(normalized);
}

function resolveCandidateName(
  candidate: string,
  resolver: NameResolver
): string | null {
  const cleaned = cleanPossibleName(candidate);

  if (!cleaned) {
    return null;
  }

  if (isKnownEmployeeName(cleaned, resolver)) {
    return resolver.resolve(cleaned);
  }

  if (isAttendanceFillerText(cleaned)) {
    return null;
  }

  return cleaned;
}

function getAttendanceKeyword(
  text: string,
  phrase: 'checkIn' | 'checkOut'
): { index: number; length: number } | null {
  const keyword =
    phrase === 'checkIn'
      ? 'checkin'
      : 'checkout';

  let normalizedText = '';
  const originalIndexes: number[] = [];

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (/[a-z]/i.test(char)) {
      normalizedText += char.toLowerCase();
      originalIndexes.push(index);
    }
  }

  const normalizedIndex =
    normalizedText.indexOf(keyword);

  if (normalizedIndex === -1) {
    return null;
  }

  const originalIndex =
    originalIndexes[normalizedIndex];

  if (originalIndex === undefined) {
    return null;
  }

  const endNormalizedIndex =
    normalizedIndex + keyword.length - 1;

  const lastOriginalIndex =
    originalIndexes[endNormalizedIndex];

  if (lastOriginalIndex === undefined) {
    return null;
  }

  return {
    index: originalIndex,
    length: lastOriginalIndex - originalIndex + 1,
  };
}

function cleanAttendanceTail(value: string): string {
  return value
    .trim()
    .replace(/^[\s:,-]+/, '')
    .replace(/^sir\b[\s:,-]*\*?/i, '')
    .trim();
}

function extractExplicitAttendanceName(
  text: string,
  phrase: 'checkIn' | 'checkOut',
  resolver: NameResolver
): string | null {
  const keyword = getAttendanceKeyword(text, phrase);

  if (!keyword) {
    return null;
  }

  const beforePhrase = text
    .slice(0, keyword.index)
    .trim();

  const afterPhrase = cleanAttendanceTail(
    text.slice(
      keyword.index + keyword.length
    )
  );

  const bracketBeforeMatch = beforePhrase.match(
  /^\*{0,2}\(\s*\*?([A-Za-z][A-Za-z ._-]{0,39})\s*\*?\)\*{0,2}/i
);
  if (bracketBeforeMatch?.[1]) {
    const resolvedName = resolveCandidateName(
      bracketBeforeMatch[1],
      resolver
    );

    if (resolvedName) {
      return resolvedName;
    }
  }

  const bracketAfterSirMatch = afterPhrase.match(
  /^sir\b[\s:,-]*\*?\(\s*\*?([A-Za-z][A-Za-z ._-]{0,39})\s*\*?\)\*{0,2}/i
);

  if (bracketAfterSirMatch?.[1]) {
    const resolvedName = resolveCandidateName(
      bracketAfterSirMatch[1],
      resolver
    );

    if (resolvedName) {
      return resolvedName;
    }
  }

  const bracketAfterMatch = afterPhrase.match(
  /^\*{0,2}\(\s*\*?([A-Za-z][A-Za-z ._-]{0,39})\s*\*?\)\*{0,2}/i
);

  if (bracketAfterMatch?.[1]) {
    const resolvedName = resolveCandidateName(
      bracketAfterMatch[1],
      resolver
    );

    if (resolvedName) {
      return resolvedName;
    }
  }

  const cleanedBefore = cleanPossibleName(
    beforePhrase
      .replace(/[()[\*\***\\\\**]\*\*,:.-]+/g, ' ')
      .replace(/\s+/g, ' ')
  );

  if (
    cleanedBefore &&
    isKnownEmployeeName(
      cleanedBefore,
      resolver
    )
  ) {
    return resolver.resolve(cleanedBefore);
  }

  let cleanedAfter = afterPhrase
    .replace(/^sir\b[\s:,-]*\*?/i, '')
    .replace(/<\s\*this message was edited\s\*>/gi, '')
    .trim();

  cleanedAfter = cleanedAfter
    .replace(
      /^\*{0,2}\(\s*\*?\d{1,2}(?::|\.)\d{1,2}\s*\*?(?:am|pm)?\s*\)?\*{0,2}/i,
      ''
    )
    .trim();

  cleanedAfter = cleanedAfter
  .replace(
    /^\*{0,2}\(\s*\*?\d{1,2}(?::|\.)\d{1,2}\s*\*?(?:am|pm)?\s*\)?\*{0,2}/i,
    ''
  )
  .trim();
 cleanedAfter = cleanPossibleName(
  cleanedAfter
    .replace(/[()[\]*\\,:.-]+/g, ' ')
    .replace(/\s+/g, ' ')
);

  if (!cleanedAfter) {
    return null;
  }

  if (
  /^\*{0,2}\(?\s*\*?\d{1,2}(?::|\.)\d{1,2}\s*\*?(?:am|pm)?\s*\)?\*{0,2}$/i.test(
    cleanedAfter
  )
) {
  return null;
}

  if (
    isKnownEmployeeName(
      cleanedAfter,
      resolver
    )
  ) {
    return resolver.resolve(cleanedAfter);
  }

  return null;
}

function normalizeAttendanceTime(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ');

  const match = cleaned.match(
    /^(\d{1,2})\s*(?::|\.)\s*(\d{1,2})\s*\*?\s*(am|pm)?$/i
  );

  if (!match) {
    return cleaned;
  }

  const hour = Number(match[1]);
  const minute = match[2].padStart(2, '0');
  const period = match[3]?.toUpperCase();

  if (period) {
    const safeHour = Math.min(
      Math.max(hour, 1),
      12
    );

    return `${safeHour}:${minute} ${period}`;
  }

  return `${hour}:${minute}`;
}

function extractExplicitAttendanceTime(
  text: string,
  phrase: 'checkIn' | 'checkOut'
): string | null {
  const keyword = getAttendanceKeyword(
    text,
    phrase
  );

  if (!keyword) {
    return null;
  }

  const beforePhrase = text
    .slice(0, keyword.index)
    .trim();

  const afterPhrase = text
    .slice(keyword.index + keyword.length)
    .trim();

  const timePattern =
    /(?:\(\s*)?(\d{1,2}\s*(?::|\.)\s*\d{1,2}\s*\*?\s*(?:am|pm)?)(?:\s*\))?/i;

  const afterMatch =
    afterPhrase.match(timePattern);

  if (afterMatch?.[1]) {
    return normalizeAttendanceTime(
      afterMatch[1]
    );
  }

  const beforeMatch =
    beforePhrase.match(timePattern);

  if (beforeMatch?.[1]) {
    return normalizeAttendanceTime(
      beforeMatch[1]
    );
  }

  return null;
}

function resolveAttendanceEmployee(
  msg: Record<string, any>,
  allNames: string[],
  phrase: 'checkIn' | 'checkOut',
  resolver: NameResolver,
  mappings: NameMapping[] = []
): string {
  const text = String(
    msg?.message || ''
  ).trim();

  const sender = String(
    msg?.sender || ''
  ).trim();

  const explicitName =
    extractExplicitAttendanceName(
      text,
      phrase,
      resolver
    );

  if (explicitName) {
    return explicitName;
  }

  return normalizeAttendanceSenderName(
    sender,
    allNames,
    mappings,
    resolver
  );
}

function getAttendanceTime(
  text: string,
  whatsappTime: string,
  phrase: 'checkIn' | 'checkOut'
): string {
  const explicitTime =
    extractExplicitAttendanceTime(
      text,
      phrase
    );

  if (explicitTime) {
    return explicitTime;
  }

  return whatsappTime || '-';
}

function createAttendanceRecord(
  normalizedName: string,
  msgDate: string
): AttendanceRecord {
  return {
    name: normalizedName,
    checkIn: '-',
    checkOut: '-',
    checkIns: [],
    checkOuts: [],
    halfDay: '-',
    permission: '-',
    weekOff: 'No',
    date: msgDate,
  };
}

function addUniqueTime(
  times: string[],
  value: string
): void {
  if (!value || value === '-') {
    return;
  }

  if (!times.includes(value)) {
    times.push(value);
  }
}

function syncPrimaryTimes(
  record: AttendanceRecord
): void {
  record.checkIn =
    record.checkIns.length > 0
      ? record.checkIns[0]
      : '-';

  record.checkOut =
    record.checkOuts.length > 0
      ? record.checkOuts[0]
      : '-';
}

export function parseAttendance(
  data: Record<string, any>[],
  targetDate?: string,
  employeeNames: string[] = CUSTOM_NAME_ORDER,
  mappings: NameMapping[] = []
): AttendanceRecord[] {
  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return [];
  }

  const targetDateString = targetDate
    ? String(targetDate)
    : '';

  const filteredData = targetDateString
    ? data.filter(
        row =>
          String(row?.date || '') ===
          targetDateString
      )
    : data;

  if (filteredData.length === 0) {
    return [];
  }

  const allNames = Array.from(
    new Set([
      ...employeeNames,
      ...CUSTOM_NAME_ORDER,
      ...data
        .map(row => row?.sender)
        .filter(Boolean)
        .map(String),
    ])
  );

  // Create ONCE for the entire attendance analysis.
  const resolver = createNameResolver(
    allNames,
    mappings
  );

  const users =
    new Map<string, AttendanceRecord>();

  for (const msg of filteredData) {
    if (!msg?.sender && !msg?.message) {
      continue;
    }

    const text = String(
      msg.message || ''
    ).trim();

    if (!text) {
      continue;
    }

    if (/\bpenalt(?:y|ies)\b/i.test(text)) {
      continue;
    }

    const whatsappTime = String(
      msg.time || ''
    ).trim();

    const msgDate = String(
      msg.date || targetDate || ''
    ).trim();

    // Normalize once instead of doing it twice.
    const normalizedAttendanceText =
      normalizeAttendanceText(text);

    const specificCheckIn =
      normalizedAttendanceText.includes(
        'checkin'
      );

    const specificCheckOut =
      normalizedAttendanceText.includes(
        'checkout'
      );

    const halfDay =
      isHalfDayText(text);

    const permission =
      isPermissionText(text);

    const weekOff =
      isWeekOffText(text);

    const hasAttendanceEvent =
      specificCheckIn ||
      specificCheckOut;

    const hasStatusEvent =
      halfDay ||
      permission ||
      weekOff;

    if (
      !hasAttendanceEvent &&
      !hasStatusEvent
    ) {
      continue;
    }

    let appliesTo: string[] = [];

    if (specificCheckIn) {
      const employeeName =
        resolveAttendanceEmployee(
          msg,
          allNames,
          'checkIn',
          resolver,
          mappings
        );

      if (employeeName) {
        appliesTo = [employeeName];
      }
    } else if (specificCheckOut) {
      const employeeName =
        resolveAttendanceEmployee(
          msg,
          allNames,
          'checkOut',
          resolver,
          mappings
        );

      if (employeeName) {
        appliesTo = [employeeName];
      }
    } else if (hasStatusEvent) {
      appliesTo = getAppliesToNames(
        msg,
        allNames,
        mappings,
        resolver
      );

      if (appliesTo.length === 0) {
        const sender = String(
          msg?.sender || ''
        ).trim();

        const normalizedSender =
          resolver.resolve(sender);

        if (normalizedSender) {
          appliesTo = [normalizedSender];
        }
      }
    }

    if (appliesTo.length === 0) {
      continue;
    }

    for (const targetName of appliesTo) {
      const normalizedName =
        resolver.resolve(targetName);

      if (!normalizedName) {
        continue;
      }

      const normalizedKey =
        normalizedName.toLowerCase();

      const key = targetDateString
        ? normalizedKey
        : `${normalizedKey}-${msgDate}`;

      let record = users.get(key);

      if (!record) {
        record = createAttendanceRecord(
          normalizedName,
          msgDate
        );

        users.set(key, record);
      }

      if (specificCheckIn) {
        const checkInTime =
          getAttendanceTime(
            text,
            whatsappTime,
            'checkIn'
          );

        addUniqueTime(
          record.checkIns,
          checkInTime
        );
      }

      if (specificCheckOut) {
        const checkOutTime =
          getAttendanceTime(
            text,
            whatsappTime,
            'checkOut'
          );

        addUniqueTime(
          record.checkOuts,
          checkOutTime
        );
      }

      if (halfDay) {
        record.halfDay = 'Yes';
      }

      if (permission) {
  record.permission = text;
}

      if (weekOff) {
        record.weekOff = 'Yes';
      }

      syncPrimaryTimes(record);
    }
  }

  const result =
    Array.from(users.values());

  return result.sort((a, b) => {
    if (!targetDateString) {
      const dateA = a.date || '';
      const dateB = b.date || '';

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
    }

    return sortByName(
      a,
      b,
      employeeNames
    );
  });
}
