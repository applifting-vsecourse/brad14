import { PrismaService } from '@/core/prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

describe('deleteOwnedQuack', () => {
  it('restricts the delete atomically to both the quack and its owner', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.deleteMany.mockResolvedValue({ count: 1 });
    const repository = new QuackRepository(prisma);
    await expect(repository.deleteOwnedQuack('q1', 'u1')).resolves.toBe(true);
    expect(prisma.quack.deleteMany).toHaveBeenCalledWith({
      where: { id: 'q1', userId: 'u1' },
    });
  });
  it('reports no deletion for a missing or foreign quack', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      new QuackRepository(prisma).deleteOwnedQuack('q1', 'u2'),
    ).resolves.toBe(false);
  });
});

it('deletes by id without an owner restriction', async () => {
  const prisma = mockDeep<PrismaService>();
  prisma.quack.deleteMany.mockResolvedValue({ count: 1 });
  await expect(new QuackRepository(prisma).deleteQuack('q1')).resolves.toBe(
    true,
  );
  expect(prisma.quack.deleteMany).toHaveBeenCalledWith({ where: { id: 'q1' } });
});
