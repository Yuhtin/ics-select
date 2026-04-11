import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider } from './anthropic.provider.js';

@Global()
@Module({
  providers: [
    {
      provide: Anthropic,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Anthropic({ apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY') }),
    },
    AnthropicProvider,
  ],
  exports: [AnthropicProvider],
})
export class AnthropicModule {}
