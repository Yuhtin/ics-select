import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export const MODEL = 'gpt-5.4-mini';

// Pricing per 1M tokens — adjust if OpenAI changes prices or the chosen model is swapped.
const INPUT_COST_PER_MTOK = 0.15;
const OUTPUT_COST_PER_MTOK = 0.6;

export type CallInput = {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
};

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };

@Injectable()
export class OpenAiChatProvider {
  constructor(private readonly client: OpenAI) {}

  async callJson<T>(input: CallInput): Promise<{ data: T; usage: Usage }> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: input.maxTokens ?? 2048,
      messages: [
        { role: 'system', content: input.system },
        ...input.messages,
      ],
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No text content in response');
    const data = JSON.parse(content) as T;
    return { data, usage: toUsage(response.usage) };
  }

  async callText(input: CallInput): Promise<{ text: string; usage: Usage }> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: input.maxTokens ?? 2048,
      messages: [
        { role: 'system', content: input.system },
        ...input.messages,
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No text content in response');
    return { text: content, usage: toUsage(response.usage) };
  }

  async *stream(input: CallInput): AsyncGenerator<string, void> {
    const stream = await this.client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: input.maxTokens ?? 2048,
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
): Usage {
  const inputTokens = raw?.prompt_tokens ?? 0;
  const outputTokens = raw?.completion_tokens ?? 0;
  const costUsd =
    (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
  return { inputTokens, outputTokens, costUsd };
}
