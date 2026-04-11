import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AesGcmService } from './aes-gcm.service.js';

@Global()
@Module({
  providers: [
    {
      provide: AesGcmService,
      useFactory: (config: ConfigService) => {
        const key = config.get<Buffer>('ENCRYPTION_KEY');
        if (!key) throw new Error('ENCRYPTION_KEY not configured');
        return new AesGcmService(key);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AesGcmService],
})
export class CryptoModule {}
