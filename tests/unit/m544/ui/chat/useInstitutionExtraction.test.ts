// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  extractInstitutionData,
  useInstitutionExtraction,
} from '@m544/ui/chat/hooks/useInstitutionExtraction';
import type { Message } from '@m544/shared/types/chat';
import { STEP_2_REPLY, PROBLEMA_DEFINITA, persisted } from './_fakes';

const history = [
  { role: 'user', content: 'E o groapă pe strada Libertății' },
  { role: 'assistant', content: PROBLEMA_DEFINITA },
  { role: 'user', content: 'da' },
  { role: 'assistant', content: STEP_2_REPLY },
];

describe('extractInstitutionData', () => {
  it('extracts name, email and problem context from a realistic STEP_2 reply', () => {
    const messages: Message[] = [
      persisted('1', 'user', 'E o groapă pe strada Libertății'),
      persisted('2', 'bot', PROBLEMA_DEFINITA),
      persisted('3', 'user', 'da'),
      persisted('4', 'bot', STEP_2_REPLY),
    ];
    expect(extractInstitutionData(messages, history, 'conv-1')).toEqual({
      institutionName: 'Primăria Municipiului Pitești',
      institutionEmail: 'primaria@primariapitesti.ro',
      problemContext: {
        ce: 'groapă în asfalt',
        unde: 'Str. Libertății 5, Pitești, Argeș',
        cand: 'martie 2026',
      },
      conversationId: 'conv-1',
    });
  });

  it('uses the LAST bot message carrying the marker', () => {
    const messages: Message[] = [
      persisted('1', 'bot', 'INSTITUȚIE_IDENTIFICATĂ: Primăria Veche\n📧 veche@primarie.ro'),
      persisted('2', 'user', 'nu'),
      persisted('3', 'bot', 'INSTITUȚIE_IDENTIFICATĂ: Tip: Consiliul Județean Argeș 📧 cj@cjarges.ro'),
    ];
    const data = extractInstitutionData(messages, [], null);
    expect(data?.institutionName).toBe('Consiliul Județean Argeș');
    expect(data?.institutionEmail).toBe('cj@cjarges.ro');
    expect(data?.problemContext).toEqual({ ce: '', unde: '', cand: '' });
    expect(data?.conversationId).toBeNull();
  });

  it('returns null without the marker or when the marker is in a user message', () => {
    expect(extractInstitutionData([persisted('1', 'bot', 'Bună ziua!')], history, 'c')).toBeNull();
    expect(
      extractInstitutionData([persisted('1', 'user', 'INSTITUȚIE_IDENTIFICATĂ: X')], history, 'c'),
    ).toBeNull();
    expect(extractInstitutionData([], history, 'c')).toBeNull();
  });

  it('returns null when the name cannot be read after the marker', () => {
    expect(extractInstitutionData([persisted('1', 'bot', 'INSTITUȚIE_IDENTIFICATĂ:\n')], [], 'c')).toBeNull();
  });
});

describe('useInstitutionExtraction', () => {
  it('returns a callback bound to the current state', () => {
    const messages: Message[] = [persisted('4', 'bot', STEP_2_REPLY)];
    const { result } = renderHook(() => useInstitutionExtraction(messages, history, 'conv-9'));
    expect(result.current()?.institutionName).toBe('Primăria Municipiului Pitești');
    expect(result.current()?.conversationId).toBe('conv-9');
  });
});
