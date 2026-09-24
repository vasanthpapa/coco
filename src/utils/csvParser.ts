import Papa from 'papaparse';

export function parseCSV(
  text: string
): Record<string, any>[] {
  const result = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  return result.data as Record<string, any>[];
}