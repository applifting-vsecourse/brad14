import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma, Quack } from '@/generated/prisma/client';
import { mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack',
  mood: null,
  userId: 'u1',
  replyThreadId: null,
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  ...overrides,
});

const createRepository = (
  quack: Quack | null = aQuack(),
): {
  prisma: PrismaService;
  transaction: Prisma.TransactionClient;
  repository: QuackRepository;
} => {
  const prisma = mockDeep<PrismaService>();
  const transaction = mockDeep<Prisma.TransactionClient>();
  prisma.quack.findUnique.mockResolvedValue(
    quack ? ({ replyThreadId: quack.replyThreadId } as Quack) : null,
  );
  prisma.$transaction.mockImplementation((operation) =>
    typeof operation === 'function'
      ? operation(transaction)
      : Promise.resolve([]),
  );
  transaction.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  transaction.quack.findUnique.mockResolvedValue(quack);
  transaction.quack.count.mockResolvedValue(0);
  transaction.quack.delete.mockResolvedValue(quack ?? aQuack());
  transaction.quackThread.deleteMany.mockResolvedValue({ count: 1 });
  return { prisma, transaction, repository: new QuackRepository(prisma) };
};

describe('quack deletion transactions', () => {
  it('checks ownership inside the locked transaction before deleting', async () => {
    const { prisma, transaction, repository } = createRepository();

    await expect(repository.deleteOwnedQuack('q1', 'u1')).resolves.toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.quack.delete).toHaveBeenCalledWith({
      where: { id: 'q1' },
    });
  });

  it('does not delete a foreign quack', async () => {
    const { transaction, repository } = createRepository(
      aQuack({ userId: 'u1' }),
    );

    await expect(repository.deleteOwnedQuack('q1', 'u2')).resolves.toBe(false);

    expect(transaction.quack.delete).not.toHaveBeenCalled();
  });

  it('returns false when the quack is missing', async () => {
    const { prisma, repository } = createRepository(null);

    await expect(repository.deleteQuack('missing')).resolves.toBe(false);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows an unrestricted caller to delete by id', async () => {
    const { transaction, repository } = createRepository();

    await expect(repository.deleteQuack('q1')).resolves.toBe(true);

    expect(transaction.quack.delete).toHaveBeenCalledWith({
      where: { id: 'q1' },
    });
  });
});
