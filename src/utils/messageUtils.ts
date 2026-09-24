import {
  normalizeEmployeeName,
} from './attendanceUtils';

export function getAppliesToNames(
  msg: Record<string, any>,
  allNames: string[]
): string[] {
  if (!msg.message) {
    return msg.sender
      ? [normalizeEmployeeName(msg.sender, allNames)]
      : [];
  }

  const text = String(msg.message);
  const mentioned: string[] = [];

  allNames.forEach(name => {
    const trimmedName = name.trim();

    if (!trimmedName) return;

    const escapedName = trimmedName.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const regex = new RegExp(
      `@?\\b${escapedName}\\b`,
      'i'
    );

    if (regex.test(text)) {
      mentioned.push(
        normalizeEmployeeName(trimmedName, allNames)
      );
    }
  });

  return mentioned.length > 0
    ? [...new Set(mentioned)]
    : msg.sender
      ? [normalizeEmployeeName(msg.sender, allNames)]
      : [];
}