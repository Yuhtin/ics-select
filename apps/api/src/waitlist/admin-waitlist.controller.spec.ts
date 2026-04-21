import { AdminWaitlistController } from './admin-waitlist.controller.js';

describe('AdminWaitlistController', () => {
  it('list parses query params and returns service result', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 }),
    } as any;
    const ctrl = new AdminWaitlistController(service);
    const result = await ctrl.list({
      page: '2',
      pageSize: '10',
      course: 'CIENCIA_COMPUTACAO',
      skillMin: '3',
      wantsUpdates: 'true',
      q: '  ada  ',
    } as any);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      pageSize: 10,
      course: 'CIENCIA_COMPUTACAO',
      skillMin: 3,
      wantsUpdates: true,
      q: 'ada',
    }));
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });

  it('list rejects invalid query params', async () => {
    const service = { list: jest.fn() } as any;
    const ctrl = new AdminWaitlistController(service);
    await expect(ctrl.list({ page: '-1' } as any)).rejects.toThrow();
    expect(service.list).not.toHaveBeenCalled();
  });

  it('stats delegates to service unchanged', async () => {
    const payload = {
      total: 12, last7d: 4, wantsUpdatesPct: 80, byCourse: [], bySkill: [],
    };
    const service = { stats: jest.fn().mockResolvedValue(payload) } as any;
    const ctrl = new AdminWaitlistController(service);
    expect(await ctrl.stats()).toEqual(payload);
  });
});
