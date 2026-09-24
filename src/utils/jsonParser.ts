export function parseJSON(
  text: string
): Record<string, any>[] {
  try {
    const data = JSON.parse(text);

    if (Array.isArray(data)) {
      return data;
    }

    if (
      typeof data === 'object' &&
      data !== null
    ) {
      return [data];
    }

    return [];
  } catch (error) {
    console.error(
      'JSON Parsing Error',
      error
    );

    return [];
  }
}