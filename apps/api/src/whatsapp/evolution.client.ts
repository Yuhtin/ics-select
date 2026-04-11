import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SendTextInput = { to: string; text: string };

@Injectable()
export class EvolutionApiClient {
  private readonly logger = new Logger(EvolutionApiClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get isConfigured(): boolean {
    return !!(
      this.config.get<string>('EVOLUTION_API_BASE_URL') &&
      this.config.get<string>('EVOLUTION_API_KEY') &&
      this.config.get<string>('EVOLUTION_INSTANCE')
    );
  }

  async sendText(input: SendTextInput): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { ok: false, error: 'Evolution API not configured' };
    }
    const baseUrl = this.config.getOrThrow<string>('EVOLUTION_API_BASE_URL');
    const apiKey = this.config.getOrThrow<string>('EVOLUTION_API_KEY');
    const instance = this.config.getOrThrow<string>('EVOLUTION_INSTANCE');
    try {
      const res = await this.fetcher(`${baseUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: input.to,
          textMessage: { text: input.text },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Evolution API returned ${res.status}: ${body}`);
        return { ok: false, error: `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
