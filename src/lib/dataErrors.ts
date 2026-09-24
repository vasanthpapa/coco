export class DataError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'DataError';
  }
}

export function requiredText(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new DataError(`${label} is required.`, 400);
  return text;
}

export function numericId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new DataError('Invalid record ID.', 400);
  return id;
}
