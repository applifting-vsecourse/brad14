import { Quack } from './quack';

export type LiveQuackFeedEntry = Quack & {
  type: 'quack';
  replyCount: number;
};

export type DeletedQuackFeedEntry = {
  type: 'deleted';
  id: string;
  createdAt: Date;
  replyCount: number;
};

export type QuackFeedEntry = LiveQuackFeedEntry | DeletedQuackFeedEntry;
