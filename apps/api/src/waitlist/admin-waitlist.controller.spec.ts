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

  it('list rejects invalid query params', () => {
    const service = { list: jest.fn() } as any;
    const ctrl = new AdminWaitlistController(service);
    expect(() => ctrl.list({ page: '-1' } as any)).toThrow();
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

  it('export streams CSV with headers and escapes quotes/commas', async () => {
    const row = {
      id: 'w-1',
      name: 'Ada "the Great"',
      email: 'ada@x.com',
      course: 'CIENCIA_COMPUTACAO',
      skillLevel: 5,
      github: 'https://github.com/ada',
      linkedin: null,
      wantsUpdates: true,
      cycleTarget: '2026.3',
      createdAt: new Date('2026-04-20T12:00:00Z'),
      updatedAt: new Date('2026-04-20T12:00:00Z'),
      ipHash: null,
      userAgent: null,
    };
    async function* gen() { yield row as any; }
    const service = { iterateAll: () => gen() } as any;
    const ctrl = new AdminWaitlistController(service);

    const chunks: string[] = [];
    const res: any = {
      setHeader: jest.fn(),
      write:     (s: string) => chunks.push(s),
      end:       jest.fn(),
    };
    await ctrl.exportCsv(res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringMatching(/^attachment; filename="waitlist-\d{8}\.csv"$/));
    const csv = chunks.join('');
    expect(csv.split('\n')[0]).toBe('createdAt,name,email,course,skillLevel,github,linkedin,wantsUpdates,cycleTarget');
    expect(csv).toContain('"Ada ""the Great"""');
    expect(res.end).toHaveBeenCalled();
  });
});
