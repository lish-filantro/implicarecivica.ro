/**
 * chat/anthropic/loop — the agentic loop: execute custom tool_use blocks and
 * feed results back, continue on pause_turn, stop at MAX_ITERATIONS.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { runAgenticLoop, MAX_ITERATIONS } from '@m544/chat/anthropic/loop';
import type { MessagesClient } from '@m544/chat/anthropic/client';
import { message, textBlock, toolUse } from '../../../../fixtures/chat/anthropic-blocks';

type Params = Anthropic.Messages.MessageCreateParamsNonStreaming;

/** Scripted client: returns the queued responses in order and records every request. */
function scriptedClient(responses: Anthropic.Messages.Message[]): MessagesClient & { calls: Params[] } {
  const calls: Params[] = [];
  const queue = [...responses];
  return {
    calls,
    messages: {
      create: async (params: Params) => {
        calls.push(structuredClone(params));
        const next = queue.shift() ?? queue[0];
        return next ?? responses[responses.length - 1];
      },
    },
  };
}

const base = {
  system: 'SYS',
  tools: [] as Anthropic.Messages.ToolUnion[],
  messages: [{ role: 'user' as const, content: 'salut' }],
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('runAgenticLoop', () => {
  it('returns immediately on end_turn with 0 iterations and the request shape', async () => {
    const client = scriptedClient([message([textBlock('gata')])]);
    const r = await runAgenticLoop({ ...base, client, executors: {} });
    expect(r.iterations).toBe(0);
    expect(r.response.content[0]).toEqual(textBlock('gata'));
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({ model: 'claude-sonnet-5', max_tokens: 4096, system: 'SYS', tools: [], messages: base.messages });
  });

  it('tool_use → executes the executor → feeds tool_result back → final answer', async () => {
    const client = scriptedClient([
      message([textBlock('caut...'), toolUse('tu_1', 'rag_search', { query: 'groapa asfalt' })], 'tool_use'),
      message([textBlock('final')]),
    ]);
    const rag = vi.fn(() => [{ slug: 'primarie' }]);
    const r = await runAgenticLoop({ ...base, client, executors: { rag_search: rag } });

    expect(rag).toHaveBeenCalledWith({ query: 'groapa asfalt' });
    expect(r.iterations).toBe(1);
    expect(r.response.stop_reason).toBe('end_turn');
    const second = client.calls[1].messages;
    expect(second).toHaveLength(3);
    expect(second[1]).toEqual({ role: 'assistant', content: [textBlock('caut...'), toolUse('tu_1', 'rag_search', { query: 'groapa asfalt' })] });
    expect(second[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: JSON.stringify([{ slug: 'primarie' }]) }],
    });
  });

  it('unknown tools and throwing executors become error tool_results', async () => {
    const client = scriptedClient([
      message([toolUse('tu_1', 'nope', {}), toolUse('tu_2', 'boom', {})], 'tool_use'),
      message([textBlock('final')]),
    ]);
    const r = await runAgenticLoop({
      ...base,
      client,
      executors: {
        boom: () => {
          throw new Error('kaput');
        },
      },
    });
    expect(r.iterations).toBe(1);
    expect(client.calls[1].messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'tu_1', content: JSON.stringify({ error: 'Tool necunoscut: nope' }) },
        { type: 'tool_result', tool_use_id: 'tu_2', content: JSON.stringify({ error: 'kaput' }) },
      ],
    });
  });

  it('pause_turn → passes the content back with "Continua." and keeps going', async () => {
    const client = scriptedClient([message([textBlock('partial')], 'pause_turn'), message([textBlock('final')])]);
    const r = await runAgenticLoop({ ...base, client, executors: {} });
    expect(r.iterations).toBe(1);
    expect(client.calls[1].messages.slice(1)).toEqual([
      { role: 'assistant', content: [textBlock('partial')] },
      { role: 'user', content: [{ type: 'text', text: 'Continua.' }] },
    ]);
  });

  it('stops after MAX_ITERATIONS (8) when the model keeps asking for tools', async () => {
    const client = scriptedClient([message([toolUse('tu', 'rag_search', { query: 'q' })], 'tool_use')]);
    const r = await runAgenticLoop({ ...base, client, executors: { rag_search: () => [] } });
    expect(MAX_ITERATIONS).toBe(8);
    expect(r.iterations).toBe(8);
    expect(client.calls).toHaveLength(9);
    expect(r.response.stop_reason).toBe('tool_use');
    expect(console.warn).toHaveBeenCalledWith('Max tool iterations reached');
  });

  it('does not mutate the caller messages array', async () => {
    const client = scriptedClient([message([toolUse('tu_1', 'rag_search', {})], 'tool_use'), message([textBlock('final')])]);
    const messages = [{ role: 'user' as const, content: 'salut' }];
    await runAgenticLoop({ ...base, messages, client, executors: { rag_search: () => [] } });
    expect(messages).toHaveLength(1);
  });
});
