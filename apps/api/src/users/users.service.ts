import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../common/cycle/active-cycle.js';

type InviteInput = { email: string; name: string };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getByIdOrThrow(id: string) {
    const user = await this.getById(id);
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async getMeById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        googleAccount: { select: { id: true, refreshTokenEnc: true } },
      },
    });
    if (!user) throw new NotFoundException('user not found');
    const membership = await resolveActiveMembership(this.prisma, id);
    // "connected" means we can make server-side Calendar calls — an account
    // without a refresh_token can't renew its access token, so the user is
    // effectively not connected for our purposes.
    const googleConnected =
      user.googleAccount !== null && user.googleAccount.refreshTokenEnc !== null;
    return {
      ...user,
      googleConnected,
      membership: membership ? { track: (membership as any).track } : null,
    };
  }

  async list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async invite(input: InviteInput) {
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        role: 'MEMBER',
      },
    });
  }

  async deleteById(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async acceptPrivacy(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { privacyAcceptedAt: new Date() },
    });
  }
}
