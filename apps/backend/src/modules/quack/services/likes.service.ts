import {
  LikesRepository,
  LikeState,
} from '@/modules/quack/repositories/likes.repository';
import { Injectable } from '@nestjs/common';

export type { LikeState } from '@/modules/quack/repositories/likes.repository';

@Injectable()
export class LikesService {
  private readonly testLikes = new Map<string, Set<string>>();

  // The default in-memory path keeps the service's small unit contract usable
  // without Nest or a database. The application always injects the repository.
  constructor(private readonly repository?: LikesRepository) {}

  async like(quackId: string, userId: string): Promise<LikeState> {
    if (this.repository) return this.repository.setLike(quackId, userId, true);
    return this.updateInMemory(quackId, userId, true);
  }

  async unlike(quackId: string, userId: string): Promise<LikeState> {
    if (this.repository) return this.repository.setLike(quackId, userId, false);
    return this.updateInMemory(quackId, userId, false);
  }

  async snapshots(
    quackIds: string[],
    userId: string,
  ): Promise<Map<string, LikeState>> {
    if (this.repository) return this.repository.snapshots(quackIds, userId);
    return new Map(
      quackIds.map((id) => {
        const users = this.testLikes.get(id);
        return [
          id,
          {
            likeCount: users?.size ?? 0,
            likedByCurrentUser: users?.has(userId) ?? false,
          },
        ];
      }),
    );
  }

  private updateInMemory(
    quackId: string,
    userId: string,
    liked: boolean,
  ): LikeState {
    let users = this.testLikes.get(quackId);
    if (!users) {
      users = new Set<string>();
      this.testLikes.set(quackId, users);
    }
    if (liked) users.add(userId);
    else users.delete(userId);
    return { likeCount: users.size, likedByCurrentUser: users.has(userId) };
  }
}
