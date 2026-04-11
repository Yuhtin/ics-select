import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export type GoogleProfilePayload = {
  email: string;
  name: string;
  pictureUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_OAUTH_CALLBACK_URL'),
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      // passport-google-oauth20 accepts these at runtime but the types don't
      // declare them on the strategy constructor options.
      accessType: 'offline',
      prompt: 'consent',
    } as never);
  }

  validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: {
      emails?: { value: string; verified?: boolean }[];
      displayName?: string;
      photos?: { value: string }[];
    },
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      return done(new UnauthorizedException('Google profile missing email'), false);
    }
    const allowed = this.config
      .getOrThrow<string[]>('ALLOWED_EMAIL_DOMAINS')
      .some((d) => email.endsWith(`@${d}`));
    if (!allowed) {
      return done(new UnauthorizedException('Email domain not allowed'), false);
    }
    const payload: GoogleProfilePayload = {
      email,
      name: profile.displayName ?? email,
      pictureUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken: refreshToken ?? null,
    };
    return done(null, payload);
  }
}
