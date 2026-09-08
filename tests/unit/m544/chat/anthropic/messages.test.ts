/**
 * chat/anthropic/messages — turning the frontend history + current message into
 * the strictly alternating user/assistant list the Messages API requires.
 */
import { describe, it, expect } from 'vitest';
import { normalizeHistory, CONVERSATION_START } from '@m544/chat/anthropic/messages';

describe('normalizeHistory', () => {
  it('empty history → just the current user message', () => {
    expect(normalizeHistory([], 'salut')).toEqual([{ role: 'user', content: 'salut' }]);
  });

  it('drops system messages', () => {
    expect(normalizeHistory([{ role: 'system', content: 'x' }, { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }], 'c')).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]);
  });

  it('merges consecutive same-role messages with a blank line', () => {
    expect(
      normalizeHistory(
        [
          { role: 'user', content: 'a1' },
          { role: 'user', content: 'a2' },
          { role: 'assistant', content: 'b1' },
          { role: 'assistant', content: 'b2' },
        ],
        'c',
      ),
    ).toEqual([
      { role: 'user', content: 'a1\n\na2' },
      { role: 'assistant', content: 'b1\n\nb2' },
      { role: 'user', content: 'c' },
    ]);
  });

  it('appends the current message to a trailing user message', () => {
    expect(normalizeHistory([{ role: 'user', content: 'a' }], 'b')).toEqual([{ role: 'user', content: 'a\n\nb' }]);
  });

  it('prepends "(start conversatie)" when the history starts with the assistant', () => {
    expect(normalizeHistory([{ role: 'assistant', content: 'Bună!' }], 'salut')).toEqual([
      { role: 'user', content: CONVERSATION_START },
      { role: 'assistant', content: 'Bună!' },
      { role: 'user', content: 'salut' },
    ]);
    expect(CONVERSATION_START).toBe('(start conversatie)');
  });

  it('does not mutate the input history', () => {
    const history = [{ role: 'user' as const, content: 'a' }];
    normalizeHistory(history, 'b');
    expect(history).toEqual([{ role: 'user', content: 'a' }]);
  });
});
