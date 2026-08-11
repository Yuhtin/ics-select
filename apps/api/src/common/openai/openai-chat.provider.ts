import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ToolDefinition, ToolExecutor, ToolCall } from './tool-calling.js';

export const MODEL = 'gpt-5.4-mini';

/**
 * The weekly-plan draft is the one call worth paying reasoning for: it picks
 * and sequences a member's whole week. Everything else (brief, diagnose, chat)
 * stays on MODEL.
 */
export const DRAFT_MODEL = 'gpt-5.6-luna';

// Pricing per 1M tokens, per model. Luna's rates are the ones after OpenAI's
// 2026-07-30 cut ($1/$6 before it) — recheck if the bill looks off. The >272k
// input tier is ignored: our prompts are nowhere near it.
const DEFAULT_PRICE = { input: 0.15, output: 0.6 };
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5.4-mini': DEFAULT_PRICE,
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
};

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export type CallInput = {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  model?: string;
  reasoningEffort?: ReasoningEffort;
};

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };

@Injectable()
export class OpenAiChatProvider {
  constructor(private readonly client: OpenAI) {}

  async callJson<T>(input: CallInput): Promise<{ data: T; usage: Usage }> {
    const model = input.model ?? MODEL;
    const response = await this.client.chat.completions.create({
      model,
      max_completion_tokens: input.maxTokens ?? 2048,
      ...(input.reasoningEffort ? { reasoning_effort: input.reasoningEffort } : {}),
      messages: [
        { role: 'system', content: input.system },
        ...input.messages,
      ],
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No text content in response');
    const data = JSON.parse(content) as T;
    return { data, usage: toUsage(response.usage, model) };
  }

  async callJsonWithTools<T>(input: {
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    tools: ToolDefinition[];
    executeTool: ToolExecutor;
    maxIterations?: number;
    maxTokens?: number;
    model?: string;
    reasoningEffort?: ReasoningEffort;
  }): Promise<{ data: T; usage: Usage; toolCalls: ToolCall[] }> {
    const maxIter = input.maxIterations ?? 5;
    const model = input.model ?? MODEL;
    // Responses API, not chat completions: OpenAI rejects function tools +
    // reasoning_effort on /v1/chat/completions ("use /v1/responses or set
    // reasoning_effort to 'none'"). The other methods here have no tools, so
    // they stay on chat completions.
    const openaiTools = input.tools.map((t) => ({
      type: 'function' as const,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      // Our tool schemas aren't strict-mode compliant (optional properties, no
      // additionalProperties: false) and strict defaults to true here.
      strict: false,
    }));

    const toolCalls: ToolCall[] = [];
    const totalUsage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    // Turn history lives server-side via previous_response_id (store defaults
    // to true), so each turn only sends what's new. If storage is ever off,
    // the stateless variant is to append every response.output item into a
    // growing input array instead.
    let previousResponseId: string | undefined;
    let nextInput: any[] = input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    for (let iter = 0; iter < maxIter; iter += 1) {
      const isFinalIter = iter === maxIter - 1;
      const response = await this.client.responses.create({
        model,
        // Not carried by previous_response_id — has to be re-sent every turn.
        instructions: input.system,
        input: nextInput,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        ...(input.reasoningEffort ? { reasoning: { effort: input.reasoningEffort } } : {}),
        max_output_tokens: input.maxTokens ?? 2048,
        // On the last iteration, force JSON object output and drop tools
        // so the model must answer rather than attempting another tool call.
        ...(isFinalIter
          ? { text: { format: { type: 'json_object' as const } } }
          : { tools: openaiTools }),
      });

      const usage = toUsage(
        {
          prompt_tokens: response.usage?.input_tokens,
          completion_tokens: response.usage?.output_tokens,
        },
        model,
      );
      totalUsage.inputTokens += usage.inputTokens;
      totalUsage.outputTokens += usage.outputTokens;
      totalUsage.costUsd += usage.costUsd;

      if (response.status === 'incomplete') {
        // Almost always max_output_tokens: reasoning tokens come out of the
        // same budget. Say so instead of failing on empty content.
        throw new Error(
          `OpenAI response incomplete (${response.incomplete_details?.reason ?? 'unknown reason'}) — max_output_tokens=${input.maxTokens ?? 2048}`,
        );
      }

      previousResponseId = response.id;
      const calls = (response.output ?? []).filter(
        (item: any) => item.type === 'function_call',
      ) as any[];

      if (calls.length > 0 && !isFinalIter) {
        nextInput = [];
        for (const call of calls) {
          const name = call.name as string;
          const argString = (call.arguments ?? '{}') as string;
          let parsedArgs: unknown;
          try {
            parsedArgs = JSON.parse(argString);
          } catch {
            parsedArgs = {};
          }
          toolCalls.push({ id: call.call_id, name, args: parsedArgs });
          const result = await input.executeTool(name, parsedArgs);
          nextInput.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify(result ?? null),
          });
        }
        continue;
      }

      // Model returned final content (or last iteration reached)
      const content = response.output_text;
      if (!content) {
        throw new Error(
          `OpenAI returned no content after iteration ${iter + 1}`,
        );
      }
      const data = JSON.parse(content) as T;
      return { data, usage: totalUsage, toolCalls };
    }

    throw new Error(`Tool-calling loop exceeded ${maxIter} iterations`);
  }

  async callText(input: CallInput): Promise<{ text: string; usage: Usage }> {
    const model = input.model ?? MODEL;
    const response = await this.client.chat.completions.create({
      model,
      max_completion_tokens: input.maxTokens ?? 2048,
      ...(input.reasoningEffort ? { reasoning_effort: input.reasoningEffort } : {}),
      messages: [
        { role: 'system', content: input.system },
        ...input.messages,
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No text content in response');
    return { text: content, usage: toUsage(response.usage, model) };
  }

  async *stream(input: CallInput): AsyncGenerator<string, void> {
    const stream = await this.client.chat.completions.create({
      model: input.model ?? MODEL,
      max_completion_tokens: input.maxTokens ?? 2048,
      ...(input.reasoningEffort ? { reasoning_effort: input.reasoningEffort } : {}),
      messages: [
        { role: 'system', content: input.system },
        ...input.messages,
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
    }
  }
}

function toUsage(
  raw: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  model: string = MODEL,
): Usage {
  const inputTokens = raw?.prompt_tokens ?? 0;
  // completion_tokens already includes reasoning tokens, so a reasoning model
  // bills correctly here without extra accounting.
  const outputTokens = raw?.completion_tokens ?? 0;
  const price = PRICING[model] ?? DEFAULT_PRICE;
  const costUsd =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output;
  return { inputTokens, outputTokens, costUsd };
}
