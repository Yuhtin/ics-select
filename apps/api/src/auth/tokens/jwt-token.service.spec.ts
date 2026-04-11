import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service';

describe('JwtTokenService', () => {
  const nest = new JwtService({ secret: 'test-secret-at-least-32-chars-abcdefgh' });
  const svc = new JwtTokenService(nest);

  it('signs and verifies a JWT with the expected payload shape', () => {
    const token = svc.sign({ sub: 'user-1', role: 'ADMIN', email: 'a@b.com' });
    const decoded = svc.verify(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.email).toBe('a@b.com');
  });

  it('rejects an invalid token', () => {
    expect(() => svc.verify('not-a-jwt')).toThrow();
  });

  it('expires after 15 minutes', () => {
    const token = svc.sign({ sub: 'u', role: 'MEMBER', email: 'e@x.com' });
    const decoded = svc.verify(token);
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });
});
