import { loadEnv } from './env';

describe('loadEnv', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'debug',
    JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long-padded',
    ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // 32 bytes base64
    GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'gocspx-test',
    GOOGLE_OAUTH_CALLBACK_URL: 'http://localhost:3001/auth/google/callback',
    ALLOWED_EMAIL_DOMAINS: 'sou.inteli.edu.br',
    BOOTSTRAP_ADMIN_EMAILS: '',
    FRONTEND_BASE_URL: 'http://localhost:3000',
    OPENAI_API_KEY: 'sk-test-key',
  };

  it('parses a valid env object', () => {
    const env = loadEnv(baseEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3001);
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.ENCRYPTION_KEY).toBeInstanceOf(Buffer);
    expect(env.ENCRYPTION_KEY.length).toBe(32);
    expect(env.ALLOWED_EMAIL_DOMAINS).toEqual(['sou.inteli.edu.br']);
    expect(env.BOOTSTRAP_ADMIN_EMAILS).toEqual([]);
    expect(env.ALLOWED_EMAIL_EXCEPTIONS).toEqual([]);
  });

  it('accepts multiple allowed domains', () => {
    const env = loadEnv({ ...baseEnv, ALLOWED_EMAIL_DOMAINS: 'sou.inteli.edu.br,inteli.edu.br' });
    expect(env.ALLOWED_EMAIL_DOMAINS).toEqual(['sou.inteli.edu.br', 'inteli.edu.br']);
  });

  it('parses email exceptions and lowercases them', () => {
    const env = loadEnv({
      ...baseEnv,
      ALLOWED_EMAIL_EXCEPTIONS: ' Consulting.Club@inteli.edu.br , staff@partner.com ',
    });
    expect(env.ALLOWED_EMAIL_EXCEPTIONS).toEqual([
      'consulting.club@inteli.edu.br',
      'staff@partner.com',
    ]);
  });

  it('parses bootstrap admin emails', () => {
    const env = loadEnv({
      ...baseEnv,
      BOOTSTRAP_ADMIN_EMAILS: 'admin@a.com, admin@b.com',
    });
    expect(env.BOOTSTRAP_ADMIN_EMAILS).toEqual(['admin@a.com', 'admin@b.com']);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => loadEnv({ ...baseEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('throws when ENCRYPTION_KEY is not 32 bytes', () => {
    expect(() => loadEnv({ ...baseEnv, ENCRYPTION_KEY: 'AAAA' })).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _DATABASE_URL, ...incomplete } = baseEnv;
    expect(() => loadEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('defaults LOG_LEVEL to info when omitted', () => {
    const { LOG_LEVEL: _LOG_LEVEL, ...withoutLogLevel } = baseEnv;
    const env = loadEnv(withoutLogLevel);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('throws when OPENAI_API_KEY is missing', () => {
    const { OPENAI_API_KEY: _key, ...incomplete } = baseEnv;
    expect(() => loadEnv(incomplete)).toThrow(/OPENAI_API_KEY/);
  });

  it('works without Evolution config', () => {
    const env = loadEnv(baseEnv);
    expect(env.EVOLUTION_API_BASE_URL).toBeUndefined();
    expect(env.EVOLUTION_API_KEY).toBeUndefined();
    expect(env.EVOLUTION_INSTANCE).toBeUndefined();
    expect(env.ADMIN_WHATSAPP_NUMBER).toBeUndefined();
  });
});
