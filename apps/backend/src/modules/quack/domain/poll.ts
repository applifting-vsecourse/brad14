export type PollMetadata = {
  id: string;
  options: { id: string; label: string; position: number }[];
};
export type PollSnapshot = {
  id: string;
  revision: string;
  options: { id: string; label: string; position: number; count: number }[];
  totalVotes: number;
  myOptionId: string | null;
};
export type PollChange = { pollId: string; revision: string };
export type CreatePoll = { options: string[] };
