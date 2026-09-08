/**
 * Off-topic detection (poems, recipes, horoscope, sports, code…). Only very
 * clear cases are flagged, to avoid false positives on legitimate requests.
 */

const OFF_TOPIC_PATTERNS = [
  /scrie.*poem|scrie.*poveste|scrie.*glum[aă]/i,
  /write.*poem|write.*story|write.*joke/i,
  /traduce|translate/i,
  /rezolv[aă].*matematic|calculeaz[aă]/i,
  /re[tț]et[aă].*g[aă]tit|re[tț]et[aă].*m[aâ]ncare/i,
  /horoscop/i,
  /cine\s+a\s+c[aâ][sș]tigat/i,
  /scor.*meci|fotbal|handbal/i,
  /genereaz[aă].*cod|scrie.*cod.*python/i,
];

export function isOffTopic(message: string): boolean {
  return OFF_TOPIC_PATTERNS.some((p) => p.test(message));
}
