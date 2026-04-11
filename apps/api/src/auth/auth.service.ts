import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { JwtTokenService } from './tokens/jwt-token.service.js';
import { RefreshTokenService } from './tokens/refresh-token.service.js';
import type { GoogleProfilePayload } from './strategies/google.strategy.js';
import { AesGcmService } from '../common/crypto/aes-gcm.service.js';

export const BOOTSTRAP_ADMIN_EMAILS_TOKEN = 'BOOTSTRAP_ADMIN_EMAILS_TOKEN';

type LoginResult = {
  user: {
    id: string;
    email: string;
    name: string;
    pictureUrl: string | null;
    role: 'ADMIN' | 'MEMBER';
    privacyAcceptedAt: Date | null;
  };
  accessToken: string;
  refreshToken: { plaintext: string; expiresAt: Date };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtTokenService,
    private readonly refresh: RefreshTokenService,
    @Inject(BOOTSTRAP_ADMIN_EMAILS_TOKEN)
    private readonly bootstrapAdmins: string[],
    private readonly aes: AesGcmService,
  ) {}

  async loginWithGoogle(profile: GoogleProfilePayload): Promise<LoginResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: profile.email } });
    const shouldBeAdmin = this.bootstrapAdmins.includes(profile.email);

    const user = existing
      ? await this.prisma.user.update({
          where: { email: profile.email },
          data: {
            name: profile.name,
            pictureUrl: profile.pictureUrl,
            ...(shouldBeAdmin && existing.role !== 'ADMIN' ? { role: 'ADMIN' } : {}),
          },
        })
      : await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            pictureUrl: profile.pictureUrl,
            role: shouldBeAdmin ? 'ADMIN' : 'MEMBER',
          },
        });

    const accessTokenEnc = this.aes.encrypt(profile.accessToken);
    const refreshTokenEnc = profile.refreshToken
      ? this.aes.encrypt(profile.refreshToken)
      : null;
    // Access tokens from Google typically last 1h. We set expiresAt to 55min to leave
    // a small safety margin; the GoogleCalendarService refreshes when close to expiry.
    const expiresAt = new Date(Date.now() + 55 * 60 * 1000);
    await this.prisma.googleAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        accessTokenEnc,
        refreshTokenEnc,
        expiresAt,
        scope: 'email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
      },
      update: {
        accessTokenEnc,
        ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
        expiresAt,
      },
    });

    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = await this.refresh.issue(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        role: user.role,
        privacyAcceptedAt: user.privacyAcceptedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshSession(plaintextRefreshToken: string): Promise<LoginResult | null> {
    const existing = await this.refresh.validate(plaintextRefreshToken);
    if (!existing) return null;
    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user) return null;
    const rotated = await this.refresh.rotate(plaintextRefreshToken, user.id);
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        role: user.role,
        privacyAcceptedAt: user.privacyAcceptedAt,
      },
      accessToken,
      refreshToken: rotated,
    };
  }

  async logout(plaintextRefreshToken: string): Promise<void> {
    await this.refresh.revoke(plaintextRefreshToken);
  }
}
