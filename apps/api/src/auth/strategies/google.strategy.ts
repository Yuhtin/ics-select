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
    });
  }

  // passport-oauth2 calls this when building Google's authorization URL.
  // Without it Google defaults to access_type=online (no refresh_token) and
  // only returns refresh_token on the very first consent, so server-side
  // API calls (listEventsInRange, etc.) fail with "No refresh token is set"
  // as soon as the access token expires.
  override authorizationParams(): Record<string, string> {
    return {
      access_type: 'offline',
      prompt: 'consent',
    };
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
    const rawExceptions = this.config.get<string[] | string>('ALLOWED_EMAIL_EXCEPTIONS') ?? [];
    const exceptions = Array.isArray(rawExceptions)
      ? rawExceptions
      : rawExceptions.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!exceptions.includes(email)) {
      const rawDomains = this.config.getOrThrow<string[] | string>('ALLOWED_EMAIL_DOMAINS');
      const domains = Array.isArray(rawDomains)
        ? rawDomains
        : rawDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
      const allowed = domains.some((d) => email.endsWith(`@${d}`));
      if (!allowed) {
        return done(new UnauthorizedException('Email domain not allowed'), false);
      }
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
