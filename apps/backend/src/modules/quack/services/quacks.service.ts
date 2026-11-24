import { CreatePoll } from '@/modules/quack/domain/poll';
import { type Quack, type QuackMood } from '@/modules/quack/domain/quack';
import { QuackFeedEntry } from '@/modules/quack/domain/quack-feed-entry';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LikesService } from './likes.service';
import { normalizePollOptions } from './poll-validation';

@Injectable()
export class QuacksService {
  constructor(
    private readonly quackRepository: QuackRepository,
    private readonly likesService?: LikesService,
  ) {}

  async getQuacks(userId?: string): Promise<QuackFeedEntry[]> {
    const entries = await this.quackRepository.getQuacks();
    if (!userId || !this.likesService) return entries;
    const liveEntries = entries.filter((entry) => entry.type === 'quack');
    const states = await this.likesService.snapshots(
      liveEntries.map((entry) => entry.id),
      userId,
    );
    return entries.map((entry) => {
      if (entry.type === 'deleted') return entry;
      return { ...entry, ...states.get(entry.id) };
    });
  }

  async getReplies(id: string, userId?: string): Promise<Quack[]> {
    const replies = await this.quackRepository.getReplies(id);
    if (!replies) throw new NotFoundException('Discussion not found');
    if (!userId || !this.likesService) return replies;
    const states = await this.likesService.snapshots(
      replies.map((reply) => reply.id),
      userId,
    );
    return replies.map((reply) => ({ ...reply, ...states.get(reply.id) }));
  }

  async createReply(user: Identity, id: string, text: string): Promise<Quack> {
    const reply = await this.quackRepository.createReply(id, user.id, text);
    if (!reply)
      throw new ConflictException('The original quack has been deleted');
    return reply;
  }

  async deleteQuack(user: Identity, id: string): Promise<void> {
    const deleted =
      user.role === 'admin'
        ? await this.quackRepository.deleteQuack(id)
        : await this.quackRepository.deleteOwnedQuack(id, user.id);
    if (deleted) return;
    if (await this.quackRepository.exists(id)) {
      throw new ForbiddenException('You can only delete your own quacks');
    }
    throw new NotFoundException('Quack not found');
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood?: QuackMood; poll?: CreatePoll },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      ...(quackData.poll
        ? { poll: { options: normalizePollOptions(quackData.poll.options) } }
        : {}),
      ...(quackData.mood ? { mood: quackData.mood } : {}),
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
