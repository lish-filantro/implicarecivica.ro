/**
 * Conversation step detection. The step is read from the assistant's own
 * markers in the recent history, then validated against the full history so a
 * manipulated history cannot skip steps:
 *   STEP_1 → STEP_2 needs PROBLEMA_DEFINITĂ (or the ✅ per-field summary)
 *   STEP_2 → STEP_3 needs INSTITUȚIE_IDENTIFICATĂ
 */
import {
  hasCompleteSummary,
  hasProblemaDefinitaMarker,
  isAssistantRole,
  normalizeMarkerText,
  type HistoryMessage,
} from './context';

export type Step = 'STEP_1' | 'STEP_2' | 'STEP_3';

/** How many trailing messages are inspected for the current step marker. */
const RECENT_WINDOW = 5;

function hasInstitutieMarker(content: string): boolean {
  return (
    normalizeMarkerText(content).includes('institutie_identificata') ||
    content.includes('INSTITUȚIE_IDENTIFICAT') ||
    content.includes('INSTITUTIE_IDENTIFICAT')
  );
}

function hasCategoriaMarker(content: string): boolean {
  return normalizeMarkerText(content).includes('categoria_') || content.includes('CATEGORIA_');
}

/**
 * Downgrade a detected step when the markers that must precede it are missing
 * from the full assistant history.
 */
export function validateStepTransition(history: HistoryMessage[], detected: Step): Step {
  if (detected === 'STEP_1') return 'STEP_1';

  const assistantMessages = history.filter((m) => isAssistantRole(m.role));
  const allText = normalizeMarkerText(assistantMessages.map((m) => m.content).join(' '));

  const hasProblemaDefinita =
    allText.includes('problema_definita') || assistantMessages.some((m) => hasCompleteSummary(m.content));
  const hasInstitutie = allText.includes('institutie_identificata');

  if (!hasProblemaDefinita) {
    console.warn(`⚠️ Step transition blocked: ${detected} without PROBLEMA_DEFINITA`);
    return 'STEP_1';
  }
  if (detected === 'STEP_3' && !hasInstitutie) {
    console.warn('⚠️ Step transition blocked: STEP_3 without INSTITUTIE_IDENTIFICATA');
    return 'STEP_2';
  }
  return detected;
}

/** Step implied by the most recent assistant marker, before validation. */
function detectRawStep(history: HistoryMessage[]): Step {
  const recent = history.slice(-RECENT_WINDOW).reverse();
  for (const msg of recent) {
    if (!isAssistantRole(msg.role)) continue;
    if (hasProblemaDefinitaMarker(msg.content) || hasCompleteSummary(msg.content)) return 'STEP_2';
    if (hasInstitutieMarker(msg.content) || hasCategoriaMarker(msg.content)) return 'STEP_3';
  }
  return 'STEP_1';
}

/** Current step of the conversation, validated against the full history. */
export function detectCurrentStep(history: HistoryMessage[]): Step {
  return validateStepTransition(history, detectRawStep(history));
}
