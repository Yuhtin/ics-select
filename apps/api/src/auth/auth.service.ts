import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { JwtTokenService } from './tokens/jwt-token.service.js';
import { RefreshTokenService } from './tokens/refresh-token.service.js';
import type { GoogleProfilePayload } from './strategies/google.strategy.js';
import { AesGcmService } from '../common/crypto/aes-gcm.service.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';
export const BOOTSTRAP_ADMIN_EMAILS_TOKEN = 'BOOTSTRAP_ADMIN_EMAILS_TOKEN';

// Marker thrown from loginWithGoogle when a first-login email is not in the
// invite allowlist or bootstrap admin list. The controller catches it and
// redirects the user to /login?error=not_invited so they get a UX instead
// of a raw 401.
export const EMAIL_NOT_INVITED = 'EMAIL_NOT_INVITED';

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
    private readonly gcal: GoogleCalendarService,
  ) {}

  async loginWithGoogle(profile: GoogleProfilePayload): Promise<LoginResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: profile.email } });
    const shouldBeAdmin = this.bootstrapAdmins.includes(profile.email);

    // First-login allowlist gate: if this email doesn't have a User row yet
    // and isn't a bootstrap admin, require a pending InvitedEmail before we
    // create the User. Domain check already ran in GoogleStrategy.validate;
    // this is the second, email-level gate.
    type InviteRow = {
      id: string;
      role: 'ADMIN' | 'MEMBER';
      cycle: { id: string; startsAt: Date; endsAt: Date; status: 'ACTIVE' | 'ARCHIVED' } | null;
    };
    let invite: InviteRow | null = null;
    if (!existing && !shouldBeAdmin) {
      const row = await this.prisma.invitedEmail.findUnique({
        where: { email: profile.email },
        include: {
          cycle: { select: { id: true, startsAt: true, endsAt: true, status: true } },
        },
      });
      if (!row) {
        throw new UnauthorizedException(EMAIL_NOT_INVITED);
      }
      invite = { id: row.id, role: row.role, cycle: row.cycle };
    }

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
            role: shouldBeAdmin ? 'ADMIN' : invite?.role ?? 'MEMBER',
          },
        });

    // Auto-enroll: if the consumed invite pinned a cycle, create the
    // CycleMembership now and delete the invite atomically. The invite is
    // only consumed on the first-login branch (!existing), so user.id was
    // just created above and cannot already have a CycleMembership — no
    // overlap check is needed here. The CyclesService.addMember path is the
    // one that needs the overlap guard.
    if (invite) {
      if (invite.cycle && invite.cycle.status !== 'ARCHIVED') {
        await this.prisma.$transaction([
          this.prisma.cycleMembership.create({
            data: { userId: user.id, cycleId: invite.cycle.id },
          }),
          this.prisma.invitedEmail.delete({ where: { id: invite.id } }),
        ]);
      } else {
        // Invite without a cycle (legacy ADMIN-only flow or pre-migration
        // invite). Drop it; admin will add the membership manually if needed.
        await this.prisma.invitedEmail.delete({ where: { id: invite.id } });
      }
    }

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
    this.gcal.invalidateAuth(user.id);

    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? undefined,
    });
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
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? undefined,
    });
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
