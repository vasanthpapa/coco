export interface ParsedMessage {
  id: string;
  date: string;
  time: string;
  sender: string;
  message: string;
}

export function parseWhatsAppChat(text: string): ParsedMessage[] {
  if (!text?.trim()) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  const messages: ParsedMessage[] = [];

  /*
   * Supports:
   *
   * iOS:
   * [22/07/26, 9:14:34 AM] Avinesh: I am check out sir
   *
   * Android:
   * 22/07/26, 9:14 am - Avinesh: I am check out sir
   *
   * Also supports:
   * [22/07/26, 9:14 AM] Name: Message
   */

  const messageRegex =
    /^\[?(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[aApP][mM])?)\]?\s*(?:-\s*)?([^:]+?):\s*(.*)$/;

  let currentMessage: ParsedMessage | null = null;
  let idCounter = 0;

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/[\u200E\u200F\u202A-\u202E\u2066\u2067]/g, '')
      .trim();

    if (!line) {
      continue;
    }

    const match = line.match(messageRegex);

    if (match) {
      if (currentMessage) {
        messages.push(currentMessage);
      }

      const [, date, time, sender, message] = match;

      currentMessage = {
        id: String(idCounter++),
        date: date.trim(),
        time: time.trim(),
        sender: sender.trim(),
        message: message.trim(),
      };

      continue;
    }

    /*
     * WhatsApp can contain multi-line messages.
     * Attach continuation lines to the previous message.
     */
    if (currentMessage) {
      currentMessage.message += `\n${line}`;
    }
  }

  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}


export function getWhatsAppMessageKey(message: ParsedMessage): string {
  return [
    message.date.trim(),
    message.time.trim().toLowerCase(),
    message.sender.trim().toLowerCase(),
    message.message.trim(),
  ].join('|');
}

export function dedupeWhatsAppMessages(
  messages: ParsedMessage[]
): ParsedMessage[] {
  const seen = new Set<string>();

  return messages.filter(message => {
    const key = getWhatsAppMessageKey(message);

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}
