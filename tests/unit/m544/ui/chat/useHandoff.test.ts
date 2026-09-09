// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHandoff, buildHandoff } from '@m544/ui/chat/hooks/useHandoff';
import { fakeQueries, HANDOFF, STEP_2_INSTITUTION, PROBLEMA_DEFINITA } from './_fakes';

const NOW = new Date('2026-09-09T12:00:00.000Z');
const now = () => NOW;
const history = [
  { role: 'user', content: 'Am o groapă pe strada mea' },
  { role: 'assistant', content: PROBLEMA_DEFINITA },
  { role: 'user', content: 'da' },
];

describe('buildHandoff', () => {
  it('maps the institution and the problem context read from the summary', () => {
    expect(buildHandoff(STEP_2_INSTITUTION, history, now)).toEqual({
      institutionName: 'Primăria Municipiului Pitești',
      institutionEmail: 'primaria@primariapitesti.ro',
      emailConfidence: 'high',
      sourceUrl: 'https://www.primariapitesti.ro',
      problemContext: { ce: 'groapă în asfalt', unde: 'Str. Libertății 5, Pitești, Argeș', cand: 'martie 2026' },
      identifiedAt: '2026-09-09T12:00:00.000Z',
      confirmedAt: null,
      sessionId: null,
      questions: null,
      questionsModel: null,
    });
  });

  it('leaves the context empty when the history has no summary', () => {
    expect(buildHandoff({ ...STEP_2_INSTITUTION, email: null, confidence: null }, [], now)).toMatchObject({
      institutionEmail: null,
      emailConfidence: null,
      problemContext: { ce: '', unde: '', cand: '' },
    });
  });
});

describe('useHandoff', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('loads the hand-off of an existing conversation', async () => {
    const { queries } = fakeQueries([], HANDOFF);
    const { result } = renderHook(() => useHandoff({ conversationId: 'conv-1', queries, now }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.handoff).toEqual(HANDOFF);
    expect(queries.getConversationHandoff).toHaveBeenCalledWith('conv-1');
  });

  it('is null without a conversation and does not query', () => {
    const { queries } = fakeQueries([], HANDOFF);
    const { result } = renderHook(() => useHandoff({ conversationId: null, queries, now }));
    expect(result.current.handoff).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(queries.getConversationHandoff).not.toHaveBeenCalled();
  });

  it('recordInstitution stores a fresh hand-off and persists it', async () => {
    const { queries, handoffs } = fakeQueries();
    const { result } = renderHook(() => useHandoff({ conversationId: 'conv-1', queries, now }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.recordInstitution(STEP_2_INSTITUTION, history, 'conv-1'));

    const expected = buildHandoff(STEP_2_INSTITUTION, history, now);
    expect(result.current.handoff).toEqual(expected);
    await waitFor(() => expect(handoffs).toEqual([{ convId: 'conv-1', handoff: expected }]));
  });

  it('a reply recorded while the load is in flight is not overwritten by the loaded value', async () => {
    const { queries, handoffs } = fakeQueries([], null);
    const { result } = renderHook(() => useHandoff({ conversationId: 'conv-1', queries, now }));
    act(() => result.current.recordInstitution(STEP_2_INSTITUTION, history, 'conv-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.handoff?.institutionName).toBe('Primăria Municipiului Pitești');
    expect(handoffs).toHaveLength(1);
  });

  it('keeps the hand-off once a request session exists', async () => {
    const withSession = { ...HANDOFF, sessionId: 's1' };
    const { queries, handoffs } = fakeQueries([], withSession);
    const { result } = renderHook(() => useHandoff({ conversationId: 'conv-1', queries, now }));
    await waitFor(() => expect(result.current.handoff).toEqual(withSession));

    act(() => result.current.recordInstitution({ ...STEP_2_INSTITUTION, name: 'Alta' }, history, 'conv-1'));

    expect(result.current.handoff).toEqual(withSession);
    expect(handoffs).toEqual([]);
  });

  it('confirm sets confirmedAt, writes STEP_3 and resolves to the conversation id', async () => {
    const { queries, handoffs, steps } = fakeQueries([], HANDOFF);
    const { result } = renderHook(() => useHandoff({ conversationId: 'conv-1', queries, now }));
    await waitFor(() => expect(result.current.handoff).toEqual(HANDOFF));

    let id: string | null = null;
    await act(async () => {
      id = await result.current.confirm();
    });

    expect(id).toBe('conv-1');
    expect(result.current.handoff).toEqual({ ...HANDOFF, confirmedAt: '2026-09-09T12:00:00.000Z' });
    expect(handoffs).toEqual([{ convId: 'conv-1', handoff: { ...HANDOFF, confirmedAt: '2026-09-09T12:00:00.000Z' } }]);
    expect(steps).toEqual([{ convId: 'conv-1', step: 'STEP_3' }]);
  });

  it('confirm keeps an earlier confirmedAt and resolves null without a hand-off', async () => {
    const confirmed = { ...HANDOFF, confirmedAt: '2026-09-09T09:00:00.000Z' };
    const { queries } = fakeQueries([], confirmed);
    const { result } = renderHook(() => useHandoff({ conversationId: 'conv-1', queries, now }));
    await waitFor(() => expect(result.current.handoff).toEqual(confirmed));
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.handoff?.confirmedAt).toBe('2026-09-09T09:00:00.000Z');

    const empty = renderHook(() => useHandoff({ conversationId: 'conv-2', queries: fakeQueries().queries, now }));
    await waitFor(() => expect(empty.result.current.loading).toBe(false));
    let id: string | null = 'x';
    await act(async () => {
      id = await empty.result.current.confirm();
    });
    expect(id).toBeNull();
  });

  it('keeps the in-memory hand-off and logs when the write fails (e.g. migration 018 missing)', async () => {
    const { queries } = fakeQueries();
    (queries.updateConversationHandoff as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('column handoff does not exist'));
    const { result } = renderHook(() => useHandoff({ conversationId: 'conv-1', queries, now }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.recordInstitution(STEP_2_INSTITUTION, history, 'conv-1'));
    expect(result.current.handoff?.institutionName).toBe('Primăria Municipiului Pitești');
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Failed to save handoff:', expect.any(Error)));

    let id: string | null = null;
    await act(async () => {
      id = await result.current.confirm();
    });
    expect(id).toBe('conv-1');
    expect(result.current.handoff?.confirmedAt).toBe('2026-09-09T12:00:00.000Z');
  });
});
