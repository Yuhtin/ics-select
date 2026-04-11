import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAiService } from './openai.service.js';
import { OpenAiChatProvider } from './openai-chat.provider.js';

@Global()
@Module({
  providers: [
    {
      provide: OpenAI,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') }),
    },
    OpenAiService,
    OpenAiChatProvider,
  ],
  exports: [OpenAiService, OpenAiChatProvider],
})
export class OpenAiModule {}
