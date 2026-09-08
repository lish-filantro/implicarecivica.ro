/**
 * Turn the model's free-text answer into a list of questions: one per line,
 * numbering/bullets stripped, headings and fragments dropped.
 */

const LIST_PREFIX = /^\s*(?:\d+[.)]|[-•*])\s*/;
const HEADING = /^(întrebări|categoria)/i;
const MIN_LENGTH = 10;

export function parseQuestions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(LIST_PREFIX, '').trim())
    .filter((line) => line.length > MIN_LENGTH && !HEADING.test(line));
}
