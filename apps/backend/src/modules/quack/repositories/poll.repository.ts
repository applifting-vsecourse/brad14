import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { PollSnapshot } from '@/modules/quack/domain/poll';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

type SnapshotRow = {
  pollId: string;
  revision: bigint;
  optionId: string;
  label: string;
  position: number;
  count: bigint;
  mine: boolean;
};

@Injectable()
export class PollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async snapshots(
    ids: string[],
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PollSnapshot[]> {
    if (!ids.length) return [];
    const rows = await client.$queryRaw<SnapshotRow[]>(Prisma.sql`
   SELECT p.id AS "pollId", p.revision, o.id AS "optionId", o.label, o.position,
     COUNT(v."userId") AS count, COALESCE(BOOL_OR(v."userId" = ${userId}), false) AS mine
   FROM poll p JOIN poll_option o ON o."pollId" = p.id
   LEFT JOIN poll_vote v ON v."pollId" = p.id AND v."optionId" = o.id
   WHERE p.id IN (${Prisma.join(ids)})
   GROUP BY p.id, p.revision, o.id, o.label, o.position ORDER BY p.id, o.position
  `);
    const snapshots = new Map<string, PollSnapshot>();
    for (const row of rows) {
      let snapshot = snapshots.get(row.pollId);
      if (!snapshot) {
        snapshot = {
          id: row.pollId,
          revision: row.revision.toString(),
          options: [],
          totalVotes: 0,
          myOptionId: null,
        };
        snapshots.set(row.pollId, snapshot);
      }
      const count = Number(row.count);
      snapshot.options.push({
        id: row.optionId,
        label: row.label,
        position: row.position,
        count,
      });
      snapshot.totalVotes += count;
      if (row.mine) snapshot.myOptionId = row.optionId;
    }
    return [...snapshots.values()];
  }

  async get(id: string, userId: string): Promise<PollSnapshot> {
    const [snapshot] = await this.snapshots([id], userId);
    if (!snapshot) throw new NotFoundException('Poll not found');
    return snapshot;
  }

  async vote(
    id: string,
    userId: string,
    optionId: string | null,
  ): Promise<PollSnapshot> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM poll WHERE id = ${id} FOR UPDATE`;
        if (!rows.length) throw new NotFoundException('Poll not found');
        if (
          optionId !== null &&
          !(await tx.pollOption.findUnique({
            where: { pollId_id: { pollId: id, id: optionId } },
          }))
        ) {
          throw new BadRequestException('Choose an answer from this poll');
        }
        const where = { pollId_userId: { pollId: id, userId } };
        const previous = await tx.pollVote.findUnique({ where });
        if (optionId === null) {
          if (previous) await tx.pollVote.delete({ where });
        } else if (previous?.optionId !== optionId) {
          await tx.pollVote.upsert({
            where,
            create: { pollId: id, userId, optionId },
            update: { optionId },
          });
        }
        const [snapshot] = await this.snapshots([id], userId, tx);
        return snapshot;
      },
      { timeout: 10000 },
    );
  }
}
