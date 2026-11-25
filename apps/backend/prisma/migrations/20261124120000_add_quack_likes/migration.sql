CREATE TABLE "like" (
  "quackId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "like_pkey" PRIMARY KEY ("quackId", "userId"),
  CONSTRAINT "like_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "like_userId_idx" ON "like"("userId");
