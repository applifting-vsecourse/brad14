-- BetterAuth normalizes new usernames to lowercase, but legacy seed data can
-- contain mixed case. Enforce the same uniqueness rule for every writer.
CREATE UNIQUE INDEX "user_username_case_insensitive_key" ON "user" (LOWER("username"));
