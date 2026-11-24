import { Injectable } from '@nestjs/common';

export type LikeState = {
  likeCount: number;
  likedByCurrentUser: boolean;
};

@Injectable()
export class LikesService {
  async like(quackId: string, userId: string): Promise<LikeState> {
    void quackId;
    void userId;
    throw new Error('not implemented');
  }

  async unlike(quackId: string, userId: string): Promise<LikeState> {
    void quackId;
    void userId;
    throw new Error('not implemented');
  }
}
