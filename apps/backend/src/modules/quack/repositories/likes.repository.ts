import { PrismaService } from '@/core/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

export type LikeState = {
  likeCount: number;
  likedByCurrentUser: boolean;
};

@Injectable()
export class LikesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async setLike(
    quackId: string,
    userId: string,
    liked: boolean,
  ): Promise<LikeState> {
    return this.prisma.$transaction(async (tx) => {
      const quack = await tx.quack.findUnique({
        where: { id: quackId },
        select: { id: true },
      });
      if (!quack) throw new NotFoundException('Quack not found');

      const where = { quackId_userId: { quackId, userId } };
      if (liked) {
        await tx.like.upsert({
          where,
          create: { quackId, userId },
          update: {},
        });
      } else {
        await tx.like.deleteMany({ where: { quackId, userId } });
      }

      const [likeCount, currentUserLike] = await Promise.all([
        tx.like.count({ where: { quackId } }),
        tx.like.findUnique({ where, select: { userId: true } }),
      ]);
      return { likeCount, likedByCurrentUser: Boolean(currentUserLike) };
    });
  }

  async snapshots(
    quackIds: string[],
    userId: string,
  ): Promise<Map<string, LikeState>> {
    const states = new Map<string, LikeState>(
      quackIds.map((id) => [id, { likeCount: 0, likedByCurrentUser: false }]),
    );
    if (!quackIds.length) return states;

    const [counts, mine] = await Promise.all([
      this.prisma.like.groupBy({
        by: ['quackId'],
        where: { quackId: { in: quackIds } },
        _count: { _all: true },
      }),
      this.prisma.like.findMany({
        where: { quackId: { in: quackIds }, userId },
        select: { quackId: true },
      }),
    ]);
    for (const row of counts) {
      const state = states.get(row.quackId);
      if (state) state.likeCount = row._count._all;
    }
    for (const row of mine) {
      const state = states.get(row.quackId);
      if (state) state.likedByCurrentUser = true;
    }
    return states;
  }
}
