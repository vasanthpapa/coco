import * as XLSX from 'xlsx';

export function parseXLSX(
  buffer: ArrayBuffer
): Record<string, any>[] {
  const workbook = XLSX.read(buffer, {
    type: 'array',
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json<Record<string, any>>(
    sheet,
    {
      defval: '',
    }
  );
}