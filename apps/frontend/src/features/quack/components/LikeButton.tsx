type LikeButtonProps = {
  quackId: string;
  likeCount: number;
  likedByCurrentUser: boolean;
  onLike: (quackId: string) => Promise<void>;
  onUnlike: (quackId: string) => Promise<void>;
};

export function LikeButton(_props: LikeButtonProps): never {
  throw new Error('not implemented');
}
