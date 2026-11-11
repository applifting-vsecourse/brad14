import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Poll,
  PollOption,
  Prisma,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { CreatePoll } from '@/modules/quack/domain/poll';
import { Quack } from '@/modules/quack/domain/quack';
import { QuackFeedEntry } from '@/modules/quack/domain/quack-feed-entry';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & {
    user?: PrismaUser;
    poll?: (Poll & { options: PollOption[] }) | null;
  },
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  poll: quack.poll
    ? {
        id: quack.poll.id,
        options: quack.poll.options.map(({ id, label, position }) => ({
          id,
          label,
          position,
        })),
      }
    : null,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
});

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.quack.count({ where: { id } })) > 0;
  }

  async deleteQuack(id: string): Promise<boolean> {
    return this.deleteWithLock(id);
  }

  async deleteOwnedQuack(id: string, userId: string): Promise<boolean> {
    return this.deleteWithLock(id, userId);
  }

  private async lockDiscussion(
    transaction: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    // The advisory-lock function returns PostgreSQL `void`. Select a stable
    // integer from a materialized CTE so Prisma's pg adapter does not need to
    // decode the unsupported `void` value returned by the lock function.
    await transaction.$queryRaw`
      WITH discussion_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))
      )
      SELECT 1 FROM discussion_lock
    `;
  }

  private async deleteWithLock(id: string, userId?: string): Promise<boolean> {
    const initial = await this.prisma.quack.findUnique({
      where: { id },
      select: { replyThreadId: true },
    });
    if (!initial) return false;
    const discussionId = initial.replyThreadId ?? id;

    return this.prisma.$transaction(async (transaction) => {
      await this.lockDiscussion(transaction, discussionId);
      const quack = await transaction.quack.findUnique({ where: { id } });
      if (!quack || (userId && quack.userId !== userId)) return false;

      if (quack.replyThreadId) {
        await transaction.quack.delete({ where: { id } });
        const remaining = await transaction.quack.count({
          where: { replyThreadId: quack.replyThreadId },
        });
        if (remaining === 0) {
          await transaction.quackThread.deleteMany({
            where: { id: quack.replyThreadId, rootQuackId: null },
          });
        }
        return true;
      }

      const replies = await transaction.quack.count({
        where: { replyThreadId: id },
      });
      await transaction.quack.delete({ where: { id } });
      if (replies === 0) {
        await transaction.quackThread.deleteMany({ where: { id } });
      }
      return true;
    });
  }

  async getQuacks(): Promise<QuackFeedEntry[]> {
    const [quacks, deletedThreads] = await Promise.all([
      this.prisma.quack.findMany({
        where: { replyThreadId: null },
        include: {
          user: true,
          poll: { include: { options: { orderBy: { position: 'asc' } } } },
          rootOfThread: { include: { _count: { select: { replies: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.quackThread.findMany({
        where: { rootQuackId: null, replies: { some: {} } },
        include: { _count: { select: { replies: true } } },
      }),
    ]);
    const liveEntries: QuackFeedEntry[] = quacks.map((quack) => ({
      ...mapPrismaQuackToDomain(quack),
      type: 'quack',
      replyCount: quack.rootOfThread?._count.replies ?? 0,
    }));
    const deletedEntries: QuackFeedEntry[] = deletedThreads.map((thread) => ({
      type: 'deleted',
      id: thread.id,
      createdAt: thread.rootPostedAt,
      replyCount: thread._count.replies,
    }));
    return [...liveEntries, ...deletedEntries].sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id.localeCompare(left.id),
    );
  }

  async getReplies(discussionId: string): Promise<Quack[] | null> {
    const thread = await this.prisma.quackThread.findUnique({
      where: { id: discussionId },
      select: { id: true },
    });
    const root = await this.prisma.quack.findFirst({
      where: { id: discussionId, replyThreadId: null },
      select: { id: true },
    });
    if (!thread && !root) return null;
    const replies = await this.prisma.quack.findMany({
      where: { replyThreadId: discussionId },
      include: {
        user: true,
        poll: { include: { options: { orderBy: { position: 'asc' } } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return replies.map(mapPrismaQuackToDomain);
  }

  async createReply(
    discussionId: string,
    userId: string,
    text: string,
  ): Promise<Quack | null> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockDiscussion(transaction, discussionId);
      const root = await transaction.quack.findFirst({
        where: { id: discussionId, replyThreadId: null },
      });
      if (!root) return null;

      await transaction.quackThread.upsert({
        where: { id: discussionId },
        create: {
          id: discussionId,
          rootQuackId: discussionId,
          rootPostedAt: root.createdAt,
        },
        update: {},
      });
      const reply = await transaction.quack.create({
        data: { text, userId, replyThreadId: discussionId },
        include: {
          user: true,
          poll: { include: { options: { orderBy: { position: 'asc' } } } },
        },
      });
      return mapPrismaQuackToDomain(reply);
    });
  }

  async createQuack(createQuackData: {
    text: string;
    mood?: Quack['mood'];
    userId: string;
    poll?: CreatePoll;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        ...(createQuackData.mood ? { mood: createQuackData.mood } : {}),
        ...(createQuackData.poll
          ? {
              poll: {
                create: {
                  options: {
                    create: createQuackData.poll.options.map(
                      (label, position) => ({
                        label,
                        normalizedLabel: label.toLowerCase(),
                        position,
                      }),
                    ),
                  },
                },
              },
            }
          : {}),
        user: { connect: { id: createQuackData.userId } },
      },
      include: {
        user: true,
        poll: { include: { options: { orderBy: { position: 'asc' } } } },
      },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
