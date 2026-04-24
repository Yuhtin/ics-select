import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SendTextInput = { to: string; text: string };

@Injectable()
export class EvolutionApiClient {
  private readonly logger = new Logger(EvolutionApiClient.name);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly fetcher: typeof fetch = fetch,
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
    // Strip trailing slash — EVOLUTION_API_BASE_URL is often configured with
    // one (https://host/), and concat with /message/... produces //message/...
    // which some reverse proxies (Traefik on EasyPanel) treat as a 404.
    const baseUrl = this.config
      .getOrThrow<string>('EVOLUTION_API_BASE_URL')
      .replace(/\/+$/, '');
    const apiKey = this.config.getOrThrow<string>('EVOLUTION_API_KEY');
    const instance = this.config.getOrThrow<string>('EVOLUTION_INSTANCE');
    const url = `${baseUrl}/message/sendText/${instance}`;
    try {
      const res = await this.fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: input.to,
          // Both the legacy (textMessage.text) and v2 (text) shape — Evolution
          // accepts the legacy form on v1 and v2.x ignores the extra key.
          text: input.text,
          textMessage: { text: input.text },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        const trimmed = body.length > 300 ? `${body.slice(0, 300)}…` : body;
        this.logger.warn(`Evolution API ${res.status} for ${url}: ${trimmed}`);
        return { ok: false, error: `HTTP ${res.status}: ${trimmed}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
