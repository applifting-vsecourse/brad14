CREATE TABLE "quack_thread" (
  "id" TEXT NOT NULL,
  "rootQuackId" TEXT,
  "rootPostedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quack_thread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quack_thread_rootQuackId_fkey" FOREIGN KEY ("rootQuackId") REFERENCES "quack"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "quack_thread_rootQuackId_key" ON "quack_thread"("rootQuackId");

ALTER TABLE "quack" ADD COLUMN "replyThreadId" TEXT;

CREATE INDEX "quack_replyThreadId_createdAt_id_idx" ON "quack"("replyThreadId", "createdAt", "id");

ALTER TABLE "quack" ADD CONSTRAINT "quack_replyThreadId_fkey" FOREIGN KEY ("replyThreadId") REFERENCES "quack_thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
