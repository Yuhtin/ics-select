import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('GET /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/unused?schema=public';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long-padded';
    process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'gocspx-test';
    process.env.GOOGLE_OAUTH_CALLBACK_URL = 'http://localhost:3001/auth/google/callback';
    process.env.ALLOWED_EMAIL_DOMAINS = 'sou.inteli.edu.br';
    process.env.BOOTSTRAP_ADMIN_EMAILS = '';
    process.env.FRONTEND_BASE_URL = 'http://localhost:3000';
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });
});
