import { LikesService, LikeState } from './likes.service';

const capture = async (
  action: Promise<LikeState>,
): Promise<{ value?: LikeState; error?: string }> => {
  try {
    return { value: await action };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

describe('LikesService — likes cases from cases.md', () => {
  let service: LikesService;

  beforeEach(() => {
    service = new LikesService();
  });

  it('RULE-01: liking an unliked quack changes count 0 to 1', async () => {
    await expect(capture(service.like('quack-1', 'user-1'))).resolves.toEqual({
      value: { likeCount: 1, likedByCurrentUser: true },
    });
  });

  it('RULE-02: unliking a liked quack changes count 1 to 0', async () => {
    await expect(capture(service.unlike('quack-1', 'user-1'))).resolves.toEqual(
      { value: { likeCount: 0, likedByCurrentUser: false } },
    );
  });

  it('RULE-03: repeating a like leaves one like and count 1', async () => {
    const results = await Promise.all([
      capture(service.like('quack-1', 'user-1')),
      capture(service.like('quack-1', 'user-1')),
    ]);
    expect(results).toEqual([
      { value: { likeCount: 1, likedByCurrentUser: true } },
      { value: { likeCount: 1, likedByCurrentUser: true } },
    ]);
  });

  it('RULE-04: repeating an unlike leaves count 0', async () => {
    const results = await Promise.all([
      capture(service.unlike('quack-1', 'user-1')),
      capture(service.unlike('quack-1', 'user-1')),
    ]);
    expect(results).toEqual([
      { value: { likeCount: 0, likedByCurrentUser: false } },
      { value: { likeCount: 0, likedByCurrentUser: false } },
    ]);
  });

  it('RULE-05: one user removing a like preserves the other user’s like', async () => {
    const results = await Promise.all([
      capture(service.like('quack-1', 'user-1')),
      capture(service.like('quack-1', 'user-2')),
      capture(service.unlike('quack-1', 'user-1')),
    ]);
    expect(results).toEqual([
      { value: { likeCount: 1, likedByCurrentUser: true } },
      { value: { likeCount: 2, likedByCurrentUser: true } },
      { value: { likeCount: 1, likedByCurrentUser: false } },
    ]);
  });

  it('RULE-06: a quack author may like their own quack', async () => {
    await expect(
      capture(service.like('quack-by-user-1', 'user-1')),
    ).resolves.toEqual({ value: { likeCount: 1, likedByCurrentUser: true } });
  });

  it('RULE-07: a reply can be liked', async () => {
    await expect(capture(service.like('reply-1', 'user-1'))).resolves.toEqual({
      value: { likeCount: 1, likedByCurrentUser: true },
    });
  });
});
