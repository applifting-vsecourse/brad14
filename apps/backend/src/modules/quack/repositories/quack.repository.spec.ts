import { PrismaService } from '@/core/prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

describe('deleteAuthorizedQuack', () => {
  it('restricts the delete atomically to both the quack and its owner', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.deleteMany.mockResolvedValue({ count: 1 });
    const repository = new QuackRepository(prisma);
    await expect(
      repository.deleteAuthorizedQuack('q1', 'u1', 'user'),
    ).resolves.toBe(true);
    expect(prisma.quack.deleteMany).toHaveBeenCalledWith({
      where: { id: 'q1', userId: 'u1' },
    });
  });
  it('reports no deletion for a missing or foreign quack', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      new QuackRepository(prisma).deleteAuthorizedQuack('q1', 'u2', 'user'),
    ).resolves.toBe(false);
  });
});

it('allows admins to delete by id without an owner restriction', async () => {
  const prisma = mockDeep<PrismaService>();
  prisma.quack.deleteMany.mockResolvedValue({ count: 1 });
  await expect(
    new QuackRepository(prisma).deleteAuthorizedQuack('q1', 'admin', 'admin'),
  ).resolves.toBe(true);
  expect(prisma.quack.deleteMany).toHaveBeenCalledWith({ where: { id: 'q1' } });
});
