import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { InvitesService } from './invites.service.js';

const makePrismaMock = () => ({
  invitedEmail: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
});

describe('InvitesService', () => {
  let service: InvitesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(InvitesService);
  });

  describe('list', () => {
    it('returns invites with inviter metadata', async () => {
      prisma.invitedEmail.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          email: 'a@a.com',
          role: 'MEMBER',
          createdAt: new Date('2026-04-20T10:00:00Z'),
          createdBy: { id: 'u-admin', name: 'Admin', email: 'admin@a.com' },
        },
      ]);
      const out = await service.list();
      expect(out).toHaveLength(1);
      expect(out[0]!.createdBy).toEqual({
        id: 'u-admin',
        name: 'Admin',
        email: 'admin@a.com',
      });
    });
  });

  describe('create', () => {
    it('rejects when a User already exists for the email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'a@a.com' });
      await expect(
        service.create({ email: 'a@a.com', role: 'MEMBER', createdById: 'admin-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lowercases and trims the email before writing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitedEmail.create.mockResolvedValue({
        id: 'inv-1',
        email: 'a@a.com',
        role: 'MEMBER',
        createdAt: new Date(),
        createdBy: null,
      });
      await service.create({
        email: '  A@a.com  ',
        role: 'MEMBER',
        createdById: 'admin-1',
      });
      expect(prisma.invitedEmail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'a@a.com' }),
        }),
      );
    });

    it('maps P2002 unique-violation to ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const err = Object.assign(new Error('unique'), { code: 'P2002' });
      prisma.invitedEmail.create.mockRejectedValue(err);
      await expect(
        service.create({ email: 'a@a.com', role: 'MEMBER', createdById: 'admin-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      prisma.invitedEmail.delete.mockResolvedValue({});
      await service.delete('inv-1');
      expect(prisma.invitedEmail.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    });

    it('maps P2025 record-not-found to NotFoundException', async () => {
      const err = Object.assign(new Error('not found'), { code: 'P2025' });
      prisma.invitedEmail.delete.mockRejectedValue(err);
      await expect(service.delete('inv-missing')).rejects.toThrow(NotFoundException);
    });
  });
});
