// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

describe('QuacksService', () => {
  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks()).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(service.createQuack(user, { text: 'hello' })).resolves.toEqual(
      created,
    );
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      userId: 'u1',
    });
  });
});

describe('quack deletion', () => {
  it('deletes using the signed-in author identity', async () => {
    const repository = mock<QuackRepository>();
    repository.deleteOwnedQuack.mockResolvedValue(true);
    await expect(
      new QuacksService(repository).deleteQuack({ id: 'u1' } as Identity, 'q1'),
    ).resolves.toBeUndefined();
    expect(repository.deleteOwnedQuack).toHaveBeenCalledWith('q1', 'u1');
  });
  it('returns 404 for a missing quack', async () => {
    const repository = mock<QuackRepository>();
    repository.deleteOwnedQuack.mockResolvedValue(false);
    repository.exists.mockResolvedValue(false);
    await expect(
      new QuacksService(repository).deleteQuack({ id: 'u2' } as Identity, 'q1'),
    ).rejects.toThrow(NotFoundException);
  });
});

it('returns 403 when the quack belongs to another author', async () => {
  const repository = mock<QuackRepository>();
  repository.deleteOwnedQuack.mockResolvedValue(false);
  repository.exists.mockResolvedValue(true);
  await expect(
    new QuacksService(repository).deleteQuack({ id: 'u2' } as Identity, 'q1'),
  ).rejects.toThrow(ForbiddenException);
  expect(repository.deleteOwnedQuack).toHaveBeenCalledWith('q1', 'u2');
});
