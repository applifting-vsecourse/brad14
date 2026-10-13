import { CreatePoll } from '@/modules/quack/domain/poll';
import { type Quack, type QuackMood } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';
import { normalizePollOptions } from './poll-validation';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(): Promise<Quack[]> {
    return this.quackRepository.getQuacks();
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
