import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AesGcmService } from './aes-gcm.service.js';

@Global()
@Module({
  providers: [
    {
      provide: AesGcmService,
      useFactory: (config: ConfigService) => {
        const raw = config.get<Buffer | string>('ENCRYPTION_KEY');
        if (!raw) throw new Error('ENCRYPTION_KEY not configured');
        // ConfigService may return either the Buffer from `loadEnv`'s transform
        // (when resolving from the internalConfig) or the raw base64 string
        // (when resolving from process.env, which takes precedence).
        const key = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'base64');
        return new AesGcmService(key);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AesGcmService],
})
export class CryptoModule {}
