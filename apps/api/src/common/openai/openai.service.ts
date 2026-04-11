import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

@Injectable()
export class OpenAiService {
  constructor(private readonly client: OpenAI) {}

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const first = response.data[0];
    if (!first) throw new Error('OpenAI returned no embedding');
    return first.embedding;
  }
}
