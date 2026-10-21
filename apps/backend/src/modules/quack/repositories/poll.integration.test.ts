import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/core/prisma/prisma.service';
import { PollsController } from '@/modules/quack/controllers/polls.controller';
import { QuacksController } from '@/modules/quack/controllers/quacks.controller';
import { PollEventsService } from '@/modules/quack/services/poll-events.service';
import { PollsService } from '@/modules/quack/services/polls.service';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { Identity } from '@/shared/auth/domain/identity';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import { PollRepository } from './poll.repository';
import { QuackRepository } from './quack.repository';

// Keep the auth provider boundary opaque; use its injection token with test sessions.
jest.mock('@/shared/auth/providers/better-auth.provider', () => ({
  InjectBetterAuth: jest
    .requireActual<typeof import('@nestjs/common')>('@nestjs/common')
    .Inject('BetterAuth'),
}));

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: (
    headers: Record<string, string | string[] | undefined>,
  ): Headers => {
    const result = new Headers();
    Object.entries(headers).forEach(([name, value]) => {
      if (value !== undefined)
        result.set(name, Array.isArray(value) ? value.join(', ') : value);
    });
    return result;
  },
}));

config({ path: '.env', quiet: true });

const prisma = new PrismaService();
const polls = new PollRepository(prisma);
const quacks = new QuacksService(new QuackRepository(prisma));
const listeners = [new PollEventsService(), new PollEventsService()];
const events: { pollId: string; revision: string }[][] = [[], []];
const users = Array.from({ length: 12 }, () => randomUUID());
let app: INestApplication;
let baseUrl: string;
let pollId: string;
let options: string[];
const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.createMany({
    data: users.map((id) => ({
      id,
      email: `${id}@poll.test`,
      name: 'Poll test',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  });
  await Promise.all(
    listeners.map(async (listener, i) => {
      await listener.onModuleInit();
      expect(listener.isReady).toBe(true);
      listener.events.subscribe((event) => {
        if (event) events[i].push(event);
      });
    }),
  );
  const module = await Test.createTestingModule({
    controllers: [PollsController, QuacksController],
    providers: [
      { provide: PollRepository, useValue: polls },
      { provide: QuacksService, useValue: quacks },
      PollsService,
      { provide: PollEventsService, useValue: listeners[0] },
      {
        provide: 'BetterAuth',
        useValue: {
          api: {
            getSession: ({
              headers,
            }: {
              headers: Headers;
            }): Promise<{ user: { id: string } } | null> =>
              Promise.resolve(
                users.find((id) => headers.get('cookie') === `user=${id}`)
                  ? {
                      user: {
                        id: headers.get('cookie')!.slice(5),
                        role:
                          headers.get('cookie') === `user=${users[10]}`
                            ? 'admin'
                            : 'user',
                      },
                    }
                  : null,
              ),
          },
        },
      },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  const quack = await quacks.createQuack({ id: users[0] } as Identity, {
    text: 'Lunch?',
    poll: { options: [' Pizza ', 'Soup'] },
  });
  pollId = quack.poll!.id;
  options = quack.poll!.options.map((option) => option.id);
}, 20000);
afterAll(async () => {
  await app?.close();
  await Promise.all(listeners.map((listener) => listener.onModuleDestroy()));
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});
it('creates ordered answers atomically and returns real zero counts', async () => {
  const result = await polls.get(pollId, users[0]);
  expect(result.options.map((option) => [option.label, option.count])).toEqual([
    ['Pizza', 0],
    ['Soup', 0],
  ]);
  expect(result.totalVotes).toBe(0);
  expect(result.myOptionId).toBeNull();
  const before = await prisma.quack.count({ where: { userId: users[0] } });
  await expect(
    quacks.createQuack({ id: users[0] } as Identity, {
      text: 'Invalid',
      poll: { options: ['Pizza', ' pizza '] },
    }),
  ).rejects.toThrow();
  expect(await prisma.quack.count({ where: { userId: users[0] } })).toBe(
    before,
  );
});
it('counts concurrent users correctly, with committed updates reaching two listeners within one second', async () => {
  const start = Date.now();
  await Promise.all(users.map((user) => polls.vote(pollId, user, options[0])));
  const snapshot = await polls.get(pollId, users[0]);
  expect(snapshot.options.map((option) => option.count)).toEqual([12, 0]);
  expect(snapshot.totalVotes).toBe(12);
  while (
    !events.every((items) =>
      items.some(
        (event) =>
          event.pollId === pollId && event.revision === snapshot.revision,
      ),
    ) &&
    Date.now() - start < 1000
  )
    await pause(10);
  expect(
    events.every((items) =>
      items.some(
        (event) =>
          event.pollId === pollId && event.revision === snapshot.revision,
      ),
    ),
  ).toBe(true);
  expect(Date.now() - start).toBeLessThan(1000);
});
it('makes repeated votes idempotent and switches/removes without double counting', async () => {
  const first = await polls.get(pollId, users[0]);
  expect((await polls.vote(pollId, users[0], options[0])).revision).toBe(
    first.revision,
  );
  const switched = await polls.vote(pollId, users[0], options[1]);
  expect(switched.options.map((option) => option.count)).toEqual([11, 1]);
  expect(switched.totalVotes).toBe(12);
  const removed = await polls.vote(pollId, users[0], null);
  expect(removed.totalVotes).toBe(11);
  expect(removed.myOptionId).toBeNull();
  expect((await polls.vote(pollId, users[0], null)).revision).toBe(
    removed.revision,
  );
});
it('serializes competing changes by one account; last accepted revision wins', async () => {
  const responses = await Promise.all([
    polls.vote(pollId, users[0], options[0]),
    polls.vote(pollId, users[0], options[1]),
    polls.vote(pollId, users[0], null),
  ]);
  const newest = responses.reduce((a, b) =>
    BigInt(a.revision) > BigInt(b.revision) ? a : b,
  );
  expect(await polls.get(pollId, users[0])).toEqual(newest);
  expect(
    await prisma.pollVote.count({ where: { pollId, userId: users[0] } }),
  ).toBeLessThanOrEqual(1);
});
it('rejects wrong-poll answers at the service and foreign-key boundaries', async () => {
  const other = await quacks.createQuack({ id: users[0] } as Identity, {
    text: 'Other?',
    poll: { options: ['A', 'B'] },
  });
  await expect(
    polls.vote(pollId, users[0], other.poll!.options[0].id),
  ).rejects.toThrow('Choose an answer from this poll');
  await expect(
    prisma.pollVote.upsert({
      where: { pollId_userId: { pollId, userId: users[0] } },
      create: { pollId, userId: users[0], optionId: other.poll!.options[0].id },
      update: { optionId: other.poll!.options[0].id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
});
it('rolls back revision/counts and emits no notifications on transaction failure', async () => {
  const before = await polls.get(pollId, users[0]);
  await pause(50);
  const lengths = events.map((items) => items.length);
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.pollVote.upsert({
        where: { pollId_userId: { pollId, userId: users[0] } },
        create: { pollId, userId: users[0], optionId: options[0] },
        update: { optionId: options[0] },
      });
      throw new Error('Rollback');
    }),
  ).rejects.toThrow('Rollback');
  await pause(50);
  expect(await polls.get(pollId, users[0])).toEqual(before);
  expect(events.map((items) => items.length)).toEqual(lengths);
});
it('keeps totals correct when account cleanup removes a voter', async () => {
  await polls.vote(pollId, users[11], options[1]);
  const before = await polls.get(pollId, users[0]);
  await prisma.user.delete({ where: { id: users[11] } });
  const after = await polls.get(pollId, users[0]);
  expect(after.totalVotes).toBe(before.totalVotes - 1);
  expect(BigInt(after.revision)).toBeGreaterThan(BigInt(before.revision));
});

it('HTTP endpoints enforce sessions, strict vote bodies, indexed validation and privacy', async () => {
  expect((await fetch(`${baseUrl}/api/polls/${pollId}`)).status).toBe(401);
  const headers = {
    Cookie: `user=${users[0]}`,
    'Content-Type': 'application/json',
  };
  for (const body of [
    {},
    { optionId: 1 },
    { optionId: null, userId: users[1] },
  ]) {
    expect(
      (
        await fetch(`${baseUrl}/api/polls/${pollId}/vote`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(400);
  }
  const invalid = await fetch(`${baseUrl}/api/quacks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text: 'Lunch?',
      poll: { options: ['Pizza', ' pizza '] },
    }),
  });
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    fieldErrors: [{ field: 'poll.options.1' }],
  });
  const response = await fetch(`${baseUrl}/api/polls?ids=${pollId},missing`, {
    headers,
  });
  const body = (await response.json()) as {
    polls: { myOptionId: string | null; options: { count: number }[] }[];
    missingIds: string[];
  };
  expect(body.missingIds).toEqual(['missing']);
  expect(body.polls).toHaveLength(1);
  expect(JSON.stringify(body)).not.toContain(users[1]);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(
    (
      await fetch(
        `${baseUrl}/api/polls?ids=${Array.from({ length: 101 }, (_, i) => `poll${i}`).join(',')}`,
        { headers },
      )
    ).status,
  ).toBe(400);
});
it('streams committed changes over HTTP SSE and serves the viewer snapshot within one second', async () => {
  const abort = new AbortController();
  const response = await fetch(`${baseUrl}/api/polls/events`, {
    headers: { Cookie: `user=${users[0]}` },
    signal: abort.signal,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  expect(response.headers.get('x-accel-buffering')).toBe('no');
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const timeout = setTimeout(() => abort.abort(), 3000);
  try {
    let text = '';
    while (!text.includes('event: ready')) {
      const chunk = await reader.read();
      text += decoder.decode(chunk.value);
    }
    const start = Date.now();
    const nextOption =
      (await polls.get(pollId, users[0])).myOptionId === options[0]
        ? options[1]
        : options[0];
    const vote = await fetch(`${baseUrl}/api/polls/${pollId}/vote`, {
      method: 'PUT',
      headers: {
        Cookie: `user=${users[0]}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ optionId: nextOption }),
    });
    expect(vote.status).toBe(200);
    while (!text.includes('event: poll-changed')) {
      const chunk = await reader.read();
      text += decoder.decode(chunk.value);
    }
    const snapshot = await fetch(`${baseUrl}/api/polls/${pollId}`, {
      headers: { Cookie: `user=${users[1]}` },
    });
    expect(
      ((await snapshot.json()) as { totalVotes: number }).totalVotes,
    ).toBeGreaterThan(0);
    expect(Date.now() - start).toBeLessThan(1000);
  } finally {
    clearTimeout(timeout);
    abort.abort();
    await reader.cancel().catch(() => undefined);
  }
});

it('ends SSE when its database listener fails and recovers automatically', async () => {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 5000);
  const response = await fetch(`${baseUrl}/api/polls/events`, {
    headers: { Cookie: `user=${users[0]}` },
    signal: abort.signal,
  });
  const reader = response.body!.getReader();
  try {
    await reader.read();
    const dedicated = (
      listeners[0] as unknown as { client: import('pg').Client }
    ).client;
    await dedicated.end();
    expect(listeners[0].isReady).toBe(false);
    let chunk = await reader.read();
    while (!chunk.done) chunk = await reader.read();
    expect(chunk.done).toBe(true);
    const deadline = Date.now() + 4000;
    while (!listeners[0].isReady && Date.now() < deadline) await pause(20);
    expect(listeners[0].isReady).toBe(true);
  } finally {
    clearTimeout(timeout);
    abort.abort();
    await reader.cancel().catch(() => undefined);
  }
}, 10000);

it('enforces deletion permissions over HTTP and cascades poll options and votes', async () => {
  const quack = await quacks.createQuack({ id: users[0] } as Identity, {
    text: 'Moderation fixture',
    poll: { options: ['Yes', 'No'] },
  });
  const id = quack.poll!.id;
  await polls.vote(id, users[1], quack.poll!.options[0].id);
  const url = `${baseUrl}/api/quacks/${quack.id}`;
  const remove = (user?: string): Promise<Response> =>
    fetch(url, {
      method: 'DELETE',
      headers: user ? { Cookie: `user=${user}` } : {},
    });
  expect((await remove()).status).toBe(401);
  expect((await remove(users[1])).status).toBe(403);
  expect(await prisma.pollVote.count({ where: { pollId: id } })).toBe(1);
  expect((await remove(users[10])).status).toBe(204);
  expect(await prisma.quack.count({ where: { id: quack.id } })).toBe(0);
  expect(await prisma.poll.count({ where: { id } })).toBe(0);
  expect(await prisma.pollOption.count({ where: { pollId: id } })).toBe(0);
  expect(await prisma.pollVote.count({ where: { pollId: id } })).toBe(0);
  expect((await remove(users[10])).status).toBe(404);
  expect((await remove(users[0])).status).toBe(404);
});
