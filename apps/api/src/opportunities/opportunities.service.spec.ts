import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpportunitiesService } from './opportunities.service';
import { PrismaService } from '../common/prisma/prisma.service';

const NOW = new Date('2026-11-10T15:00:00Z');
const member = { sub: 'm1', role: 'MEMBER' } as any;
const admin = { sub: 'a1', role: 'ADMIN' } as any;

const row = (o: any = {}) => ({
  id: 'o1', title: 'T', type: 'INTERNSHIP', companyName: 'C', description: null, location: null,
  workMode: null, compensation: null, deadline: null, eventDate: null, links: [], contacts: [],
  status: 'PUBLISHED', publishedAt: new Date('2026-11-01T00:00:00Z'), createdById: 'm1',
  createdAt: NOW, updatedAt: NOW,
  createdBy: { id: 'm1', name: 'M', role: 'MEMBER' }, interests: [], ...o,
});
const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('OpportunitiesService', () => {
  let svc: OpportunitiesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      cycleMembership: { findFirst: jest.fn().mockResolvedValue({ cycleId: 'c' }) },
      opportunity: {
        findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(),
        create: jest.fn(async ({ data }: any) => row(data)),
        update: jest.fn(async ({ data }: any) => row(data)), delete: jest.fn(),
      },
      opportunityInterest: { upsert: jest.fn(), deleteMany: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [OpportunitiesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(OpportunitiesService);
  });

  it('forbids a member without active membership', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue(null);
    await expect(svc.list(member, {}, NOW)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.get(member, 'o1', NOW)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.setInterest(member, 'o1', true, NOW)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('member create is forced PUBLISHED with publishedAt', async () => {
    await svc.create(member, { title: 'T', type: 'INTERNSHIP', companyName: 'C', status: 'DRAFT', links: [], contacts: [] } as any, NOW);
    const data = prisma.opportunity.create.mock.calls[0][0].data;
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt).toEqual(NOW);
    expect(data.createdById).toBe('m1');
  });

  it('admin create defaults to DRAFT with null publishedAt', async () => {
    await svc.create(admin, { title: 'T', type: 'EVENT', companyName: 'C', deadline: '2026-12-01', links: [], contacts: [] } as any, NOW);
    const data = prisma.opportunity.create.mock.calls[0][0].data;
    expect(data.status).toBe('DRAFT');
    expect(data.publishedAt).toBeNull();
    expect(data.deadline).toEqual(d('2026-12-01'));
  });

  it("member cannot update someone else's opportunity", async () => {
    prisma.opportunity.findUnique.mockResolvedValue(row({ createdById: 'other' }));
    await expect(svc.update(member, 'o1', { title: 'x' }, NOW)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it('member cannot set DRAFT on own opportunity', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(row());
    await expect(svc.update(member, 'o1', { status: 'DRAFT' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publishedAt is not reset on unarchive', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(row({ status: 'ARCHIVED' }));
    await svc.update(member, 'o1', { status: 'PUBLISHED' }, NOW);
    expect(prisma.opportunity.update.mock.calls[0][0].data.publishedAt).toBeUndefined();
  });

  it('publishedAt is set the first time it becomes PUBLISHED and absent links are not reset', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(row({ status: 'DRAFT', publishedAt: null, createdById: 'a1' }));
    await svc.update(admin, 'o1', { status: 'PUBLISHED' }, NOW);
    const data = prisma.opportunity.update.mock.calls[0][0].data;
    expect(data.publishedAt).toEqual(NOW);
    expect('links' in data).toBe(false);
  });

  it('member get of a DRAFT is 404', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(row({ status: 'DRAFT' }));
    await expect(svc.get(member, 'o1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('list hides DRAFT from members and sorts open-by-closing-date first', async () => {
    prisma.opportunity.findMany.mockResolvedValue([
      row({ id: 'closed', deadline: d('2026-11-01') }),
      row({ id: 'nodl', publishedAt: d('2026-11-05') }),
      row({ id: 'later', deadline: d('2026-12-20') }),
      row({ id: 'soon', deadline: d('2026-11-12') }),
      row({ id: 'archived', status: 'ARCHIVED' }),
    ]);
    const out = await svc.list(member, {}, NOW);
    expect(prisma.opportunity.findMany.mock.calls[0][0].where.status).toEqual({ in: ['PUBLISHED', 'ARCHIVED'] });
    expect(out.map((o) => o.id)).toEqual(['soon', 'later', 'nodl', 'closed', 'archived']);
    expect(out[0]!.deadline).toBe('2026-11-12');
    expect(out[0]!.isOpen).toBe(true);
  });

  it('admin list includes DRAFT', async () => {
    await svc.list(admin, {}, NOW);
    expect(prisma.opportunity.findMany.mock.calls[0][0].where.status).toBeUndefined();
  });

  it('setInterest twice upserts; remove without row uses deleteMany', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(row());
    expect(await svc.setInterest(member, 'o1', true, NOW)).toEqual({ ok: true });
    expect(await svc.setInterest(member, 'o1', true, NOW)).toEqual({ ok: true });
    expect(prisma.opportunityInterest.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.opportunityInterest.upsert.mock.calls[0][0].where).toEqual({ userId_opportunityId: { userId: 'm1', opportunityId: 'o1' } });
    expect(await svc.setInterest(member, 'o1', false, NOW)).toEqual({ ok: true });
    expect(prisma.opportunityInterest.deleteMany).toHaveBeenCalledWith({ where: { userId: 'm1', opportunityId: 'o1' } });
  });

  it('setInterest on closed opportunity is 409 (both directions)', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(row({ deadline: d('2026-11-09') }));
    await expect(svc.setInterest(member, 'o1', true, NOW)).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.setInterest(member, 'o1', false, NOW)).rejects.toBeInstanceOf(ConflictException);
  });

  it('interestedBy is honored for admin and ignored for member', async () => {
    prisma.opportunity.findMany.mockResolvedValue([
      row({ id: 'open', interests: [{ userId: 'u9', createdAt: NOW, user: { name: 'U', pictureUrl: null } }] }),
      row({ id: 'closed', deadline: d('2026-11-01'), interests: [{ userId: 'u9', createdAt: NOW, user: { name: 'U', pictureUrl: null } }] }),
    ]);
    const a = await svc.list(admin, { interestedBy: 'u9' }, NOW);
    expect(a.map((o) => o.id)).toEqual(['open']);
    expect(prisma.opportunity.findMany.mock.calls[0][0].where.interests).toEqual({ some: { userId: 'u9' } });
    await svc.list(member, { interestedBy: 'u9' }, NOW);
    expect(prisma.opportunity.findMany.mock.calls[1][0].where.interests).toBeUndefined();
  });
});
