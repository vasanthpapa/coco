export type ReportType =
  | 'name'
  | 'date'
  | 'pdf'
  | 'penalty'
  | 'analytics';

export interface TimeZone {
  start: string;
  end: string;
}

export type PenaltyView = 'overall' | 'explicit';

export interface PeriodFilter {
  month: number | 'all';
  year: number | 'all';
  view: PenaltyView;
}