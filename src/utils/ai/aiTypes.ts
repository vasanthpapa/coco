export interface AIAttendanceRecord {
  date: string;
  name: string;
  checkIn: string;
  checkOut: string;
  halfDay: 'Yes' | '-';
  permission: 'Yes' | '-';
  status?: string;
}

export interface AIPenaltyRecord {
  date: string;
  name: string;
  amount: number;
  reason: string;
}

export interface AIOtherRecord {
  date: string;
  type: string;
  name?: string;
  details: string;
}

export interface AIAnalysisResult {
  attendance: AIAttendanceRecord[];
  penalties: AIPenaltyRecord[];
  other: AIOtherRecord[];
}