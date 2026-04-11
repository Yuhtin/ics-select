import { AesGcmService } from './aes-gcm.service';
import { randomBytes } from 'crypto';

describe('AesGcmService', () => {
  const key = randomBytes(32);
  const svc = new AesGcmService(key);

  it('round-trips a plaintext string', () => {
    const cipher = svc.encrypt('hello world');
    expect(cipher).not.toBe('hello world');
    expect(svc.decrypt(cipher)).toBe('hello world');
  });

  it('produces different ciphertexts for the same plaintext', () => {
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext', () => {
    const cipher = svc.encrypt('integrity');
    const tampered = cipher.slice(0, -2) + (cipher.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('rejects ciphertext encrypted with a different key', () => {
    const other = new AesGcmService(randomBytes(32));
    const cipher = svc.encrypt('cross-key');
    expect(() => other.decrypt(cipher)).toThrow();
  });

  it('rejects construction with a wrong-length key', () => {
    expect(() => new AesGcmService(randomBytes(16))).toThrow(/32/);
  });
});
