import { AlertsService } from './alerts.service';

describe('AlertsService', () => {
  it('creates a DismissedAlert row with 24h TTL', async () => {
    const create = jest.fn(async (args: any) => args.data);
    const prisma = { dismissedAlert: { create } } as any;
    const svc = new AlertsService(prisma);
    const before = Date.now();
    await svc.dismiss('admin-1', { alertType: 'STUCK_RECENT', targetId: 'item-42' });
    const after = Date.now();
    expect(create).toHaveBeenCalledTimes(1);
    const call = create.mock.calls[0]![0];
    expect(call.data.userId).toBe('admin-1');
    expect(call.data.alertType).toBe('STUCK_RECENT');
    expect(call.data.targetId).toBe('item-42');
    const expiresMs = call.data.expiresAt.getTime();
    // expiresAt should be roughly 24h from now (+/- a bit for clock drift)
    expect(expiresMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000);
  });
});
