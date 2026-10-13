import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { ConflictException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { ProfileRepository } from './profile.repository';

const data = {
  username: 'New.Duck',
  name: 'Duck',
  bio: 'Hello',
  defaultMood: 'none' as const,
};
describe('ProfileRepository', () => {
  it('updates only the signed-in user and normalizes usernames and no mood', async () => {
    const prisma = mockDeep<PrismaService>();
    const repo = new ProfileRepository(prisma);
    await repo.update('u1', data);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: {
          ...data,
          username: 'new.duck',
          displayUsername: 'new.duck',
          defaultMood: null,
        },
      }),
    );
  });
  it('reports a uniqueness conflict even when another save races it', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: '7',
      }),
    );
    await expect(
      new ProfileRepository(prisma).update('u1', data),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('does not report database failures as duplicate usernames', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.user.update.mockRejectedValue(new Error('Offline'));
    await expect(
      new ProfileRepository(prisma).update('u1', data),
    ).rejects.toThrow('Offline');
  });
});
