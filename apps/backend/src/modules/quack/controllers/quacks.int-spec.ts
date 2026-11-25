import { randomUUID } from 'node:crypto';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/core/prisma/prisma.service';
import { BetterAuth } from '@/shared/auth/providers/better-auth.provider';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as request from 'supertest';

describe('GET /api/quacks (HTTP integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (
      !new URL(process.env.DATABASE_URL ?? '').pathname.endsWith(
        '/quacker_test',
      )
    ) {
      throw new Error('Integration tests must use the quacker_test database');
    }

    app = await NestFactory.create(AppModule, { logger: false });
    const auth = app.get<BetterAuth>('BetterAuth');
    const instance = app.getHttpAdapter().getInstance();
    app.use(cookieParser());
    instance.all('/api/auth/*splat', toNodeHandler(auth));
    instance.use(express.json());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "quack", "poll", "poll_option", "poll_vote", "quack_thread", "session", "account", "verification", "user" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 401 to a signed-out visitor and 200 to a signed-in user', async () => {
    await request(app.getHttpServer()).get('/api/quacks').expect(401);

    const id = randomUUID();
    const email = `${id}@integration.test`;
    const password = 'Integration-password-123!';
    const signUp = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Integration User',
        username: `int${id.replace(/-/g, '').slice(0, 12)}`,
        email,
        password,
      });
    expect(signUp.status).toBe(200);

    const signedIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers['set-cookie'];
    expect(cookie).toBeDefined();
    const cookieHeader = (Array.isArray(cookie) ? cookie : [cookie])
      .map((value) => value.split(';', 1)[0])
      .join('; ');

    await request(app.getHttpServer())
      .get('/api/quacks')
      .set('Cookie', cookieHeader)
      .expect(200);
  });
});
