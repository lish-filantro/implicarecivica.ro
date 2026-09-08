/**
 * Agentic loop over the Messages API.
 *
 * Server-side tools (web_search, web_fetch) are executed by Anthropic; we only loop when
 *   - stop_reason === 'tool_use'   → run our custom tools and send tool_results
 *   - stop_reason === 'pause_turn' → send the partial turn back with "Continua."
 * up to MAX_ITERATIONS extra calls.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { chatModel, MAX_TOKENS, type MessagesClient } from './client';

export type ToolExecutor = (input: unknown) => unknown | Promise<unknown>;

export const MAX_ITERATIONS = 8;

export interface LoopOptions {
  client: MessagesClient;
  system: string;
  tools: Anthropic.Messages.ToolUnion[];
  messages: Anthropic.Messages.MessageParam[];
  /** Custom tools by name; unknown names get an error tool_result. */
  executors: Record<string, ToolExecutor>;
  model?: string;
  maxIterations?: number;
}

export interface LoopResult {
  response: Anthropic.Messages.Message;
  iterations: number;
}

async function executeTool(
  block: Anthropic.Messages.ToolUseBlock,
  executors: Record<string, ToolExecutor>,
): Promise<Anthropic.Messages.ToolResultBlockParam> {
  let result: unknown;
  try {
    const executor = executors[block.name];
    result = executor ? await executor(block.input) : { error: `Tool necunoscut: ${block.name}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  Tool ${block.name} failed:`, message);
    result = { error: message };
  }
  return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) };
}

async function executeToolBlocks(
  content: Anthropic.Messages.ContentBlock[],
  executors: Record<string, ToolExecutor>,
): Promise<Anthropic.Messages.ToolResultBlockParam[]> {
  const results: Anthropic.Messages.ToolResultBlockParam[] = [];
  for (const block of content) {
    if (block.type === 'tool_use') results.push(await executeTool(block, executors));
  }
  return results;
}

export async function runAgenticLoop(opts: LoopOptions): Promise<LoopResult> {
  const model = opts.model ?? chatModel();
  const maxIterations = opts.maxIterations ?? MAX_ITERATIONS;
  const messages = [...opts.messages];

  const call = () =>
    opts.client.messages.create({ model, max_tokens: MAX_TOKENS, system: opts.system, tools: opts.tools, messages });

  let response = await call();
  let iterations = 0;

  while ((response.stop_reason === 'tool_use' || response.stop_reason === 'pause_turn') && iterations < maxIterations) {
    iterations++;
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'pause_turn') {
      console.log(`  Pause turn — continuing (iteration ${iterations})`);
      messages.push({ role: 'user', content: [{ type: 'text', text: 'Continua.' }] });
    } else {
      console.log(`  Custom tool iteration ${iterations}/${maxIterations}`);
      messages.push({ role: 'user', content: await executeToolBlocks(response.content, opts.executors) });
    }
    response = await call();
  }

  if (iterations >= maxIterations) console.warn('Max tool iterations reached');
  return { response, iterations };
}
