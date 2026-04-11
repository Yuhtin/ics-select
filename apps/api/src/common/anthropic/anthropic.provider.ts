import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-sonnet-4-5-20250929';

// Pricing per 1M tokens (as of this phase). Adjust when Anthropic changes prices.
const INPUT_COST_PER_MTOK = 3.0;
const OUTPUT_COST_PER_MTOK = 15.0;

export type CallInput = {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: Anthropic.Tool[];
  maxTokens?: number;
};

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };

@Injectable()
export class AnthropicProvider {
  constructor(private readonly client: Anthropic) {}

  async callJson<T>(input: CallInput): Promise<{ data: T; usage: Usage }> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: input.maxTokens ?? 2048,
      system: input.system,
      messages: input.messages,
      tools: input.tools,
    });
    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text block in response');
    const data = JSON.parse(block.text) as T;
    return { data, usage: toUsage(response.usage) };
  }

  async callText(input: CallInput): Promise<{ text: string; usage: Usage }> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: input.maxTokens ?? 2048,
      system: input.system,
      messages: input.messages,
    });
    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text block in response');
    return { text: block.text, usage: toUsage(response.usage) };
  }

  stream(input: CallInput) {
    return this.client.messages.stream({
      model: MODEL,
      max_tokens: input.maxTokens ?? 2048,
      system: input.system,
      messages: input.messages,
      tools: input.tools,
    });
  }
}

function toUsage(raw: { input_tokens: number; output_tokens: number }): Usage {
  const costUsd =
    (raw.input_tokens / 1_000_000) * INPUT_COST_PER_MTOK +
    (raw.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
  return {
    inputTokens: raw.input_tokens,
    outputTokens: raw.output_tokens,
    costUsd,
  };
}
