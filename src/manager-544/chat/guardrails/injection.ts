/**
 * Prompt-injection detection: regex patterns (Romanian, English, structural
 * prompt-format markers) plus two heuristics (encoded payloads, Cyrillic
 * homoglyphs next to injection keywords). Detected messages are replaced
 * entirely so no attack content ever reaches the model.
 */

export const MAX_MESSAGE_LENGTH = 2000;

const ROMANIAN_PATTERNS = [
  /uit[aă].*instruc[tț]iuni/i,
  /ignor[aă].*reguli/i,
  /ac[tț]ioneaz[aă]\s+ca/i,
  /tu\s+e[sș]ti\s+acum/i,
  /sar[iî]\s+peste/i,
  /schimb[aă].*rol/i,
  /modific[aă].*instruc/i,
  /nu\s+mai\s+urma/i,
  /f[aă]\s+abstrac[tț]ie/i,
  /abandon[eaă].*flux/i,
  /nu\s+[tț]ine\s+cont/i,
  /las[aă].*deoparte/i,
  /renun[tț][aă]\s+la.*instruc/i,
  /afi[sș]eaz[aă].*prompt/i,
  /arat[aă].*instruc[tț]iuni/i,
];

const ENGLISH_PATTERNS = [
  /forget.*instructions/i,
  /ignore.*rules/i,
  /ignore.*previous/i,
  /ignore.*above/i,
  /act\s+as/i,
  /you\s+are\s+now/i,
  /system\s*role/i,
  /override.*instructions/i,
  /disregard/i,
  /pretend\s+you/i,
  /new\s+instructions/i,
  /do\s+not\s+follow/i,
  /bypass/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  /reveal.*prompt/i,
  /show.*system.*prompt/i,
];

/** Prompt-format injection ([SYSTEM], [INST], <<SYS>>, "Human:" / "Assistant:" turns…) */
const STRUCTURAL_PATTERNS = [
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /###\s*system/i,
  /```system/i,
  /\bsystem\s*prompt\b/i,
  /\bhuman\s*:\s*/i,
  /\bassistant\s*:\s*/i,
];

const INJECTION_PATTERNS = [...ROMANIAN_PATTERNS, ...ENGLISH_PATTERNS, ...STRUCTURAL_PATTERNS];

/** Messages longer than this are checked for an unusual share of special characters. */
const SPECIAL_CHAR_MIN_LENGTH = 100;
const SPECIAL_CHAR_MAX_RATIO = 0.3;

const SANITIZED_REPLACEMENT = 'Această întrebare nu este legată de Legea 544/2001. Te rog să revii la subiect.';

export function isPromptInjectionAttempt(message: string): boolean {
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(message))) return true;

  // Heuristic: too many special characters (possible encoded payload)
  if (message.length > SPECIAL_CHAR_MIN_LENGTH) {
    const specialCharCount = (message.match(/[^\w\sîăâșțÎĂÂȘȚ.,!?;:()"-]/g) || []).length;
    if (specialCharCount / message.length > SPECIAL_CHAR_MAX_RATIO) return true;
  }

  // Heuristic: Cyrillic homoglyphs combined with injection-related keywords
  if (/[Ѐ-ӿ]/.test(message) && /instruc|ignor|forget|system|prompt/i.test(message)) return true;

  return false;
}

/**
 * Cap the length and, when an injection is detected, replace the whole message
 * with a neutral redirect (zero original content reaches the model).
 */
export function sanitizeMessage(message: string): string {
  const capped = message.length > MAX_MESSAGE_LENGTH ? message.substring(0, MAX_MESSAGE_LENGTH) : message;
  if (isPromptInjectionAttempt(capped)) {
    console.warn('⚠️ Prompt injection attempt detected');
    return SANITIZED_REPLACEMENT;
  }
  return capped;
}
