import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaMock = {
  adminNote: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function makePrisma(overrides: Partial<any> = {}): PrismaMock {
  const base: PrismaMock = {
    adminNote: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      create: jest.fn(async (args: any) => ({ id: 'new-note', createdAt: new Date(), ...args.data })),
      update: jest.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      delete: jest.fn(async (args: any) => ({ id: args.where.id })),
    },
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    base[key] = { ...base[key], ...(overrides[key] as any) };
  }
  return base;
}

function makeService(prisma: PrismaMock): NotesService {
  return new NotesService(prisma as unknown as PrismaService);
}

describe('NotesService', () => {
  describe('listForMember', () => {
    it('lists notes for a member ordered by createdAt desc', async () => {
      const notes = [
        { id: 'n2', aboutId: 'member-1', authorId: 'admin-1', text: 'newer', createdAt: new Date('2026-04-17T12:00:00Z') },
        { id: 'n1', aboutId: 'member-1', authorId: 'admin-1', text: 'older', createdAt: new Date('2026-04-16T12:00:00Z') },
      ];
      const prisma = makePrisma({
        adminNote: { findMany: jest.fn(async () => notes) },
      });
      const service = makeService(prisma);

      const result = await service.listForMember('member-1');

      expect(result).toEqual(notes);
      expect(prisma.adminNote.findMany).toHaveBeenCalledWith({
        where: { aboutId: 'member-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('creates a note with the provided fields', async () => {
      const created = {
        id: 'note-1',
        aboutId: 'member-1',
        authorId: 'admin-1',
        text: 'a helpful note',
        createdAt: new Date('2026-04-17T12:00:00Z'),
      };
      const prisma = makePrisma({
        adminNote: { create: jest.fn(async () => created) },
      });
      const service = makeService(prisma);

      const result = await service.create({
        aboutId: 'member-1',
        authorId: 'admin-1',
        text: 'a helpful note',
      });

      expect(result).toEqual(created);
      expect(prisma.adminNote.create).toHaveBeenCalledWith({
        data: {
          aboutId: 'member-1',
          authorId: 'admin-1',
          text: 'a helpful note',
        },
      });
    });
  });

  describe('update', () => {
    it('updates a note when the author matches', async () => {
      const existing = {
        id: 'note-1',
        aboutId: 'member-1',
        authorId: 'admin-1',
        text: 'old',
        createdAt: new Date(),
      };
      const updated = { ...existing, text: 'new' };
      const prisma = makePrisma({
        adminNote: {
          findUnique: jest.fn(async () => existing),
          update: jest.fn(async () => updated),
        },
      });
      const service = makeService(prisma);

      const result = await service.update('note-1', 'admin-1', 'new');

      expect(result).toEqual(updated);
      expect(prisma.adminNote.findUnique).toHaveBeenCalledWith({ where: { id: 'note-1' } });
      expect(prisma.adminNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { text: 'new' },
      });
    });

    it('throws ForbiddenException when a different admin tries to update', async () => {
      const existing = {
        id: 'note-1',
        aboutId: 'member-1',
        authorId: 'admin-1',
        text: 'old',
        createdAt: new Date(),
      };
      const prisma = makePrisma({
        adminNote: { findUnique: jest.fn(async () => existing) },
      });
      const service = makeService(prisma);

      await expect(service.update('note-1', 'admin-2', 'new')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.adminNote.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when updating a missing note', async () => {
      const prisma = makePrisma({
        adminNote: { findUnique: jest.fn(async () => null) },
      });
      const service = makeService(prisma);

      await expect(service.update('missing', 'admin-1', 'new')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.adminNote.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a note when the author matches', async () => {
      const existing = {
        id: 'note-1',
        aboutId: 'member-1',
        authorId: 'admin-1',
        text: 'keep',
        createdAt: new Date(),
      };
      const prisma = makePrisma({
        adminNote: {
          findUnique: jest.fn(async () => existing),
          delete: jest.fn(async () => existing),
        },
      });
      const service = makeService(prisma);

      await expect(service.delete('note-1', 'admin-1')).resolves.toBeUndefined();
      expect(prisma.adminNote.delete).toHaveBeenCalledWith({ where: { id: 'note-1' } });
    });

    it('throws ForbiddenException when a different admin tries to delete', async () => {
      const existing = {
        id: 'note-1',
        aboutId: 'member-1',
        authorId: 'admin-1',
        text: 'keep',
        createdAt: new Date(),
      };
      const prisma = makePrisma({
        adminNote: { findUnique: jest.fn(async () => existing) },
      });
      const service = makeService(prisma);

      await expect(service.delete('note-1', 'admin-2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.adminNote.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when deleting a missing note', async () => {
      const prisma = makePrisma({
        adminNote: { findUnique: jest.fn(async () => null) },
      });
      const service = makeService(prisma);

      await expect(service.delete('missing', 'admin-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.adminNote.delete).not.toHaveBeenCalled();
    });
  });
});
