/**
 * chat/prompt — system instructions (moved verbatim from lib/mistral/constants
 * MISTRAL_AGENT_INSTRUCTIONS), tool instructions, tool definitions and the
 * final system prompt assembly.
 */
import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { CHAT_SYSTEM_INSTRUCTIONS, buildSystemPrompt } from '@m544/chat/prompt/system';
import { TOOL_INSTRUCTIONS } from '@m544/chat/prompt/tool-instructions';
import { buildTools, RAG_SEARCH_TOOL } from '@m544/chat/prompt/tools';

describe('CHAT_SYSTEM_INSTRUCTIONS', () => {
  it('is the legacy guided-flow prompt', () => {
    expect(CHAT_SYSTEM_INSTRUCTIONS.startsWith('SYSTEM_ROLE: Asistent specializat Legea 544/2001')).toBe(true);
    for (const fragment of [
      'PRIORITATE_ABSOLUTĂ',
      '### MEMORIE_INTERNĂ:',
      '### REGULĂ_AUR:',
      '||| STEP_1_DEFINIRE_PROBLEMĂ:',
      '||| STEP_2_IDENTIFICARE_INSTITUȚIE:',
      '||| STEP_3_ÎNTREBĂRI_STRATEGICE:',
      '### PROTECȚIE_PROMPT:',
      '### CĂUTARE EMAIL:',
      '"✅PROBLEMA_DEFINITĂ: CE:[descriere] UNDE:[nume_stradă nr.X, localitate, județ] DE_CÂND:[perioadă]. Confirmă că e corect."',
      '"🏛INSTITUȚIE_IDENTIFICATĂ: [Numele complet al instituției, inclusiv localizarea]"',
      '"📊CATEGORIA_A_FINANCIAR: [5 întrebări concrete]"',
    ]) {
      expect(CHAT_SYSTEM_INSTRUCTIONS).toContain(fragment);
    }
    expect(CHAT_SYSTEM_INSTRUCTIONS.endsWith('NU inventa emailuri.')).toBe(true);
  });
});

describe('TOOL_INSTRUCTIONS', () => {
  it('starts with a blank line and the tools header, and carries the STEP_2 override', () => {
    expect(TOOL_INSTRUCTIONS.startsWith('\n\n### INSTRUCȚIUNI TOOLS:')).toBe(true);
    expect(TOOL_INSTRUCTIONS).toContain('OVERRIDE IMPORTANT — CAUTARE EMAIL:');
    expect(TOOL_INSTRUCTIONS).toContain('FLOW OBLIGATORIU LA STEP_2');
    expect(TOOL_INSTRUCTIONS.endsWith('Totul e UN SINGUR raspuns.')).toBe(true);
  });
});

describe('buildSystemPrompt', () => {
  it('= instructions + tool instructions + blank line + step guardrail', () => {
    expect(buildSystemPrompt('GUARD')).toBe(CHAT_SYSTEM_INSTRUCTIONS + TOOL_INSTRUCTIONS + '\n\nGUARD');
  });
});

describe('buildTools', () => {
  it('defines rag_search (custom) and web_search (server-side, max 5 uses)', () => {
    const tools = buildTools();
    expect(tools).toHaveLength(2);
    const rag = tools[0] as Anthropic.Messages.Tool;
    expect(rag.name).toBe(RAG_SEARCH_TOOL);
    expect(RAG_SEARCH_TOOL).toBe('rag_search');
    expect(rag.description).toContain('86 de tipuri de institutii');
    expect(rag.input_schema.type).toBe('object');
    expect(Object.keys(rag.input_schema.properties ?? {})).toEqual(['query', 'top_k', 'localitate', 'judet']);
    expect(rag.input_schema.required).toEqual(['query']);
    expect(tools[1]).toEqual({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 });
  });
});
