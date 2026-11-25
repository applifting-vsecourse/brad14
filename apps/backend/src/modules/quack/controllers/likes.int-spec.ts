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

type AuthorizedAgent = {
  get(path: string): request.Test;
  post(path: string): request.Test;
  put(path: string): request.Test;
  delete(path: string): request.Test;
};

describe('quack likes HTTP API — cases.md', () => {
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
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "quack", "poll", "poll_option", "poll_vote", "quack_thread", "session", "account", "verification", "user" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  const signedInAgent = async (): Promise<AuthorizedAgent> => {
    const id = randomUUID();
    const server = app.getHttpServer();
    const signUp = await request(server)
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Like Integration User',
        username: `like${id.replace(/-/g, '').slice(0, 12)}`,
        email: `${id}@integration.test`,
        password: 'Integration-password-123!',
      });
    expect(signUp.status).toBe(200);
    const signIn = await request(server)
      .post('/api/auth/sign-in/email')
      .send({
        email: `${id}@integration.test`,
        password: 'Integration-password-123!',
      });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers['set-cookie'];
    const cookieHeader = (Array.isArray(cookie) ? cookie : [cookie])
      .map((value) => value.split(';', 1)[0])
      .join('; ');
    return {
      get: (path: string): request.Test =>
        request(server).get(path).set('Cookie', cookieHeader),
      post: (path: string): request.Test =>
        request(server).post(path).set('Cookie', cookieHeader),
      put: (path: string): request.Test =>
        request(server).put(path).set('Cookie', cookieHeader),
      delete: (path: string): request.Test =>
        request(server).delete(path).set('Cookie', cookieHeader),
    };
  };

  const createQuack = async (agent: AuthorizedAgent): Promise<string> => {
    const response = await agent
      .post('/api/quacks')
      .send({ text: `Like fixture ${randomUUID()}` });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const readState = async (
    agent: AuthorizedAgent,
    quackId: string,
  ): Promise<{
    likeCount: number | undefined;
    likedByCurrentUser: boolean | undefined;
  }> => {
    const response = await agent.get('/api/quacks');
    expect(response.status).toBe(200);
    const quack = response.body.find(
      (entry: { id: string }) => entry.id === quackId,
    );
    return {
      likeCount: quack?.likeCount,
      likedByCurrentUser: quack?.likedByCurrentUser,
    };
  };

  it('API-01: signed-out like and unlike requests return 401 and do not change state', async () => {
    const owner = await signedInAgent();
    const quackId = await createQuack(owner);
    const liked = await request(app.getHttpServer()).put(
      `/api/quacks/${quackId}/likes`,
    );
    const unliked = await request(app.getHttpServer()).delete(
      `/api/quacks/${quackId}/likes`,
    );
    const state = await readState(owner, quackId);

    expect({ statuses: [liked.status, unliked.status], state }).toEqual({
      statuses: [401, 401],
      state: { likeCount: 0, likedByCurrentUser: false },
    });
  });

  it('API-02: a signed-in user can like and then unlike a quack', async () => {
    const agent = await signedInAgent();
    const quackId = await createQuack(agent);
    const before = await readState(agent, quackId);
    const likeResponse = await agent.put(`/api/quacks/${quackId}/likes`);
    const afterLike = await readState(agent, quackId);
    const unlikeResponse = await agent.delete(`/api/quacks/${quackId}/likes`);
    const afterUnlike = await readState(agent, quackId);

    expect({
      before,
      likeSucceeded: likeResponse.ok,
      afterLike,
      unlikeSucceeded: unlikeResponse.ok,
      afterUnlike,
    }).toEqual({
      before: { likeCount: 0, likedByCurrentUser: false },
      likeSucceeded: true,
      afterLike: { likeCount: 1, likedByCurrentUser: true },
      unlikeSucceeded: true,
      afterUnlike: { likeCount: 0, likedByCurrentUser: false },
    });
  });

  it('API-03: repeating a like keeps one like and count 1', async () => {
    const agent = await signedInAgent();
    const quackId = await createQuack(agent);
    const first = await agent.put(`/api/quacks/${quackId}/likes`);
    const second = await agent.put(`/api/quacks/${quackId}/likes`);
    const state = await readState(agent, quackId);

    expect({ succeeded: [first.ok, second.ok], state }).toEqual({
      succeeded: [true, true],
      state: { likeCount: 1, likedByCurrentUser: true },
    });
  });

  it('API-04: repeating an unlike keeps count 0', async () => {
    const agent = await signedInAgent();
    const quackId = await createQuack(agent);
    const first = await agent.delete(`/api/quacks/${quackId}/likes`);
    const second = await agent.delete(`/api/quacks/${quackId}/likes`);
    const state = await readState(agent, quackId);

    expect({ succeeded: [first.ok, second.ok], state }).toEqual({
      succeeded: [true, true],
      state: { likeCount: 0, likedByCurrentUser: false },
    });
  });

  it('API-05: one user can remove their like without removing another user’s like', async () => {
    const firstUser = await signedInAgent();
    const secondUser = await signedInAgent();
    const quackId = await createQuack(firstUser);
    const firstLike = await firstUser.put(`/api/quacks/${quackId}/likes`);
    const secondLike = await secondUser.put(`/api/quacks/${quackId}/likes`);
    const removeFirst = await firstUser.delete(`/api/quacks/${quackId}/likes`);
    const firstState = await readState(firstUser, quackId);
    const secondState = await readState(secondUser, quackId);

    expect({
      succeeded: [firstLike.ok, secondLike.ok, removeFirst.ok],
      firstState,
      secondState,
    }).toEqual({
      succeeded: [true, true, true],
      firstState: { likeCount: 1, likedByCurrentUser: false },
      secondState: { likeCount: 1, likedByCurrentUser: true },
    });
  });

  it('API-06: a quack author can like their own quack', async () => {
    const author = await signedInAgent();
    const quackId = await createQuack(author);
    const response = await author.put(`/api/quacks/${quackId}/likes`);
    const state = await readState(author, quackId);

    expect({ succeeded: response.ok, state }).toEqual({
      succeeded: true,
      state: { likeCount: 1, likedByCurrentUser: true },
    });
  });

  it('API-07: a reply can be liked', async () => {
    const agent = await signedInAgent();
    const rootId = await createQuack(agent);
    const reply = await agent
      .post(`/api/quacks/${rootId}/replies`)
      .send({ text: 'A reply to like' });
    expect(reply.status).toBe(201);
    const response = await agent.put(`/api/quacks/${reply.body.id}/likes`);
    const replies = await agent.get(`/api/quacks/${rootId}/replies`);
    const likedReply = replies.body.find(
      (entry: { id: string }) => entry.id === reply.body.id,
    );

    expect({
      succeeded: response.ok,
      likeCount: likedReply?.likeCount,
      likedByCurrentUser: likedReply?.likedByCurrentUser,
    }).toEqual({
      succeeded: true,
      likeCount: 1,
      likedByCurrentUser: true,
    });
  });

  it('API-08: a deleted quack returns 404 and cannot receive a like', async () => {
    const agent = await signedInAgent();
    const quackId = await createQuack(agent);
    const reply = await agent
      .post(`/api/quacks/${quackId}/replies`)
      .send({ text: 'Keep the thread after its root is deleted' });
    expect(reply.status).toBe(201);
    const deleted = await agent.delete(`/api/quacks/${quackId}`);
    expect(deleted.status).toBe(204);
    const response = await agent.put(`/api/quacks/${quackId}/likes`);

    expect(response.status).toBe(404);
  });

  it('API-09: a refreshed feed reports aggregate likes and the current user state', async () => {
    const firstUser = await signedInAgent();
    const secondUser = await signedInAgent();
    const quackId = await createQuack(firstUser);
    const secondUserLike = await secondUser.put(`/api/quacks/${quackId}/likes`);
    const refreshedState = await readState(firstUser, quackId);

    expect({ succeeded: secondUserLike.ok, refreshedState }).toEqual({
      succeeded: true,
      refreshedState: { likeCount: 1, likedByCurrentUser: false },
    });
  });
});
