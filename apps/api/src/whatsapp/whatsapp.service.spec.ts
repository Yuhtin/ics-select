import { WhatsappService } from './whatsapp.service';

const client = { sendText: jest.fn() };
const prisma = {
  whatsappLog: {
    create: jest.fn(async ({ data }: any) => ({ id: 'log-1', ...data })),
  },
};

describe('WhatsappService', () => {
  beforeEach(() => {
    client.sendText.mockReset();
    prisma.whatsappLog.create.mockClear();
  });

  it('logs a successful send', async () => {
    client.sendText.mockResolvedValue({ ok: true });
    const svc = new WhatsappService(client as any, prisma as any);
    await svc.send({ userId: 'u-1', kind: 'session_reminder', to: '5511', text: 'hi' });
    const call = prisma.whatsappLog.create.mock.calls[0]![0] as any;
    expect(call.data.kind).toBe('session_reminder');
    expect(call.data.deliveredAt).not.toBeNull();
    expect(call.data.error).toBeNull();
  });

  it('logs an error when client fails', async () => {
    client.sendText.mockResolvedValue({ ok: false, error: 'not configured' });
    const svc = new WhatsappService(client as any, prisma as any);
    await svc.send({ userId: 'u-1', kind: 'session_reminder', to: '5511', text: 'hi' });
    const call = prisma.whatsappLog.create.mock.calls[0]![0] as any;
    expect(call.data.deliveredAt).toBeNull();
    expect(call.data.error).toBe('not configured');
  });
});
