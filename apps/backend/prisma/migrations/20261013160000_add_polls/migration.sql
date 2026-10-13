CREATE TABLE "poll" (
 "id" TEXT PRIMARY KEY, "quackId" TEXT NOT NULL UNIQUE REFERENCES "quack"("id") ON DELETE CASCADE,
 "revision" BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE "poll_option" (
 "id" TEXT PRIMARY KEY, "pollId" TEXT NOT NULL REFERENCES "poll"("id") ON DELETE CASCADE,
 "position" INTEGER NOT NULL CHECK ("position" BETWEEN 0 AND 5),
 "label" VARCHAR(100) NOT NULL CHECK (char_length(btrim("label")) > 0 AND "label" = btrim("label")),
 "normalizedLabel" VARCHAR(100) NOT NULL,
 UNIQUE ("pollId", "id"), UNIQUE ("pollId", "position"), UNIQUE ("pollId", "normalizedLabel")
);
CREATE TABLE "poll_vote" (
 "pollId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
 "optionId" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("pollId", "userId"),
 FOREIGN KEY ("pollId", "optionId") REFERENCES "poll_option"("pollId", "id") ON DELETE CASCADE
);
CREATE INDEX "poll_vote_pollId_optionId_idx" ON "poll_vote"("pollId", "optionId");
CREATE INDEX "poll_vote_userId_idx" ON "poll_vote"("userId");

-- Counts come from vote rows. Any committed change, including account cleanup,
-- advances the revision and notifies all API instances. Aborted writes notify nobody.
CREATE FUNCTION notify_poll_vote_change() RETURNS TRIGGER AS $$
DECLARE changed_poll TEXT; next_revision BIGINT;
BEGIN
 IF TG_OP = 'UPDATE' AND OLD."optionId" = NEW."optionId" THEN RETURN NEW; END IF;
 IF TG_OP = 'DELETE' THEN changed_poll := OLD."pollId"; ELSE changed_poll := NEW."pollId"; END IF;
 UPDATE "poll" SET "revision" = "revision" + 1 WHERE "id" = changed_poll RETURNING "revision" INTO next_revision;
 IF FOUND THEN PERFORM pg_notify('poll_changes', json_build_object('pollId', changed_poll, 'revision', next_revision::text)::text); END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER poll_vote_changed AFTER INSERT OR UPDATE OR DELETE ON "poll_vote"
 FOR EACH ROW EXECUTE FUNCTION notify_poll_vote_change();
