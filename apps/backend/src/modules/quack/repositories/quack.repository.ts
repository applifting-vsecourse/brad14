import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Poll,
  PollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { CreatePoll } from '@/modules/quack/domain/poll';
import { Quack } from '@/modules/quack/domain/quack';
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

  async getQuacks(): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      include: {
        user: true,
        poll: { include: { options: { orderBy: { position: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
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
