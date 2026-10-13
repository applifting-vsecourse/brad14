import { PollSnapshot } from '@/modules/quack/domain/poll';
import { PollRepository } from '@/modules/quack/repositories/poll.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PollsService {
  constructor(private readonly polls: PollRepository) {}
  get(id: string, userId: string): Promise<PollSnapshot> {
    return this.polls.get(id, userId);
  }
  async list(
    ids: string[],
    userId: string,
  ): Promise<{ polls: PollSnapshot[]; missingIds: string[] }> {
    const polls = await this.polls.snapshots(ids, userId);
    const found = new Set(polls.map((poll) => poll.id));
    return { polls, missingIds: ids.filter((id) => !found.has(id)) };
  }
  vote(
    id: string,
    userId: string,
    optionId: string | null,
  ): Promise<PollSnapshot> {
    return this.polls.vote(id, userId, optionId);
  }
}
