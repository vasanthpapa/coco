import { GoogleGenerativeAI } from '@google/generative-ai';

export async function parseWithAI(
  text: string
): Promise<Record<string, any>[]> {
  if (!text?.trim()) {
    throw new Error(
      'Text is required for AI parsing.'
    );
  }

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server.'
    );
  }

  const genAI =
    new GoogleGenerativeAI(apiKey);

  const model =
    genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });

  const prompt = `
You are a highly intelligent data extraction assistant.

I will give you unstructured text which might be a messy chat log or raw attendance data.

Your job is to extract employee attendance records from it.

For each person mentioned, determine:

1. Date they are referring to.
2. Employee name.
3. Check In time based on words like:
   "in", "check in", "login", "morning", "vandhuten".
4. Check Out time based on words like:
   "out", "check out", "logout", "leave", "kelamburen".
5. If they mention "half day" or "HD", set halfDay to "Yes".
6. If they mention "permission" or "perm", set permission to "Yes".

If check-in or check-out is unavailable, use "-".

Do not invent information.

Return exactly and only a JSON array.

The objects must use this exact schema:

[
  {
    "date": "DD/MM/YYYY",
    "name": "Employee Name",
    "checkIn": "HH:MM AM/PM",
    "checkOut": "HH:MM AM/PM",
    "halfDay": "Yes or -",
    "permission": "Yes or -"
  }
]

Important:
- Do not include markdown.
- Do not include explanations.
- Do not wrap the response in \`\`\`json.
- Return only valid JSON.
- Preserve employee names as accurately as possible.
- Do not create duplicate records unnecessarily.
- If multiple attendance events belong to the same employee and date, combine them into one record where possible.

Here is the unstructured text:

${text}
`;

  try {
    const result =
      await model.generateContent(prompt);

    const response =
      await result.response;

    let jsonText =
      response.text().trim();

    /*
     * Remove accidental markdown fences.
     */

    jsonText = jsonText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    /*
     * Handle accidental text before/after JSON.
     */

    const firstBracket =
      jsonText.indexOf('[');

    const lastBracket =
      jsonText.lastIndexOf(']');

    if (
      firstBracket !== -1 &&
      lastBracket !== -1 &&
      lastBracket > firstBracket
    ) {
      jsonText =
        jsonText.slice(
          firstBracket,
          lastBracket + 1
        );
    }

    const parsed =
      JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      throw new Error(
        'AI did not return a JSON array.'
      );
    }

    return parsed;
  } catch (error) {
    console.error(
      'AI Parsing failed:',
      error
    );

    throw new Error(
      'Failed to parse data with AI. Make sure GEMINI_API_KEY is configured correctly and the text contains recognizable attendance data.'
    );
  }
}
