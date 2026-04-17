import { WhatsappPurgeCron } from './whatsapp-purge.cron';

describe('WhatsappPurgeCron', () => {
  function makeCron(deleteResult: { count: number } = { count: 0 }) {
    const deleteMany = jest.fn(async () => deleteResult);
    const prisma = { whatsappLog: { deleteMany } };
    return {
      cron: new WhatsappPurgeCron(prisma as any),
      deleteMany,
    };
  }

  it('deletes rows where sentAt < now - 90 days', async () => {
    const { cron, deleteMany } = makeCron({ count: 12 });
    const now = new Date('2026-04-17T12:00:00Z');
    await cron.purge(now);
    const expectedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { sentAt: { lt: expectedCutoff } },
    });
  });

  it('does nothing when no rows match', async () => {
    const { cron, deleteMany } = makeCron({ count: 0 });
    await expect(cron.purge(new Date())).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });
});
