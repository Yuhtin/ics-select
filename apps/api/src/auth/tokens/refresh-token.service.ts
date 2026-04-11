import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string): Promise<{ plaintext: string; expiresAt: Date }> {
    const plaintext = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hash(plaintext);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return { plaintext, expiresAt };
  }

  async validate(plaintext: string): Promise<{ id: string; userId: string } | null> {
    const tokenHash = this.hash(plaintext);
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!rec) return null;
    if (rec.revokedAt) return null;
    if (rec.expiresAt.getTime() < Date.now()) return null;
    return { id: rec.id, userId: rec.userId };
  }

  async revoke(plaintext: string): Promise<void> {
    const tokenHash = this.hash(plaintext);
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!rec) return;
    await this.prisma.refreshToken.update({
      where: { id: rec.id },
      data: { revokedAt: new Date() },
    });
  }

  async rotate(plaintext: string, userId: string): Promise<{ plaintext: string; expiresAt: Date }> {
    await this.revoke(plaintext);
    return this.issue(userId);
  }

  private hash(plaintext: string): string {
    // We use SHA-256 rather than bcrypt for refresh tokens because the tokens are
    // already high-entropy (48 random bytes) and we need O(1) lookup by hash.
    // bcrypt is appropriate for low-entropy passwords, not random tokens.
    return createHash('sha256').update(plaintext).digest('hex');
  }
}
