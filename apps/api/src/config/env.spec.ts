import { loadEnv } from './env';

describe('loadEnv', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'debug',
  };

  it('parses a valid env object', () => {
    const env = loadEnv(baseEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('splits CORS_ALLOWED_ORIGINS on comma', () => {
    const env = loadEnv({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: 'https://a.com,https://b.com',
    });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...incomplete } = baseEnv;
    expect(() => loadEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('throws when PORT is not a number', () => {
    expect(() => loadEnv({ ...baseEnv, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('defaults LOG_LEVEL to info when omitted', () => {
    const { LOG_LEVEL, ...withoutLogLevel } = baseEnv;
    const env = loadEnv(withoutLogLevel);
    expect(env.LOG_LEVEL).toBe('info');
  });
});
