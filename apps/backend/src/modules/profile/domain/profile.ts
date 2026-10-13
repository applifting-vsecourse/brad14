export type Profile = {
  id: string;
  username: string | null;
  name: string;
  bio: string;
  defaultMood: 'happy' | 'sad' | 'angry' | 'silly' | null;
};
export type ProfileUpdate = Omit<Profile, 'id' | 'username' | 'defaultMood'> & {
  username: string;
  defaultMood: 'none' | NonNullable<Profile['defaultMood']>;
};
