import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService, BOOTSTRAP_ADMIN_EMAILS_TOKEN } from './auth.service.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtTokenService } from './tokens/jwt-token.service.js';
import { RefreshTokenService } from './tokens/refresh-token.service.js';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    JwtStrategy,
    JwtTokenService,
    RefreshTokenService,
    {
      provide: BOOTSTRAP_ADMIN_EMAILS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string[]>('BOOTSTRAP_ADMIN_EMAILS'),
    },
  ],
  exports: [AuthService, JwtTokenService, RefreshTokenService],
})
export class AuthModule {}
