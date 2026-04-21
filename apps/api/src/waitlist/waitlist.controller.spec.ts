import { BadRequestException } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller.js';

function makeReq(ip = '203.0.113.1', ua = 'jest/1.0') {
  return {
    ip,
    headers: { 'user-agent': ua, 'x-forwarded-for': ip },
  } as any;
}

describe('WaitlistController', () => {
  const validBody = {
    name: 'Ada Lovelace',
    email: 'ada@sou.inteli.edu.br',
    course: 'CIENCIA_COMPUTACAO',
    skillLevel: 4,
    year: 2,
  };

  it('accepts a valid submission and delegates to service', async () => {
    const service = { submit: jest.fn().mockResolvedValue({ ok: true }) } as any;
    const ctrl = new WaitlistController(service);
    const res = await ctrl.submit(validBody, makeReq());
    expect(res).toEqual({ ok: true });
    expect(service.submit).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@sou.inteli.edu.br' }),
      expect.any(String),
      expect.stringContaining('jest'),
    );
  });

  it('throws BadRequestException on invalid body', async () => {
    const service = { submit: jest.fn() } as any;
    const ctrl = new WaitlistController(service);
    await expect(ctrl.submit({ ...validBody, email: 'not-an-email' }, makeReq()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('hashes the IP (sha256) — never forwards the raw value', async () => {
    const service = { submit: jest.fn().mockResolvedValue({ ok: true }) } as any;
    const ctrl = new WaitlistController(service);
    await ctrl.submit(validBody, makeReq('203.0.113.1'));
    const [, ipHash] = service.submit.mock.calls[0];
    expect(ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(ipHash).not.toContain('203');
  });

  it('truncates user-agent to 255 chars', async () => {
    const service = { submit: jest.fn().mockResolvedValue({ ok: true }) } as any;
    const ctrl = new WaitlistController(service);
    await ctrl.submit(validBody, makeReq('203.0.113.1', 'a'.repeat(400)));
    const [, , ua] = service.submit.mock.calls[0];
    expect(ua.length).toBe(255);
  });
});
