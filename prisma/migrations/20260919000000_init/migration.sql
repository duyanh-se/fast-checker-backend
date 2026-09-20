-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('LOBBY', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('FIND_FAKE', 'EVIDENCE_HUNT', 'TIMELINE');

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "adminToken" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'LOBBY',
    "currentOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSession" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "truthMeter" INTEGER NOT NULL DEFAULT 50,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "solution" JSONB NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "baseScore" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeAttempt" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "answer" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correct" BOOLEAN,
    "feedback" JSONB,
    CONSTRAINT "ChallengeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_code_key" ON "GameSession"("code");
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");
CREATE UNIQUE INDEX "PlayerSession_token_key" ON "PlayerSession"("token");
CREATE INDEX "PlayerSession_sessionId_totalScore_idx" ON "PlayerSession"("sessionId", "totalScore");
CREATE UNIQUE INDEX "PlayerSession_sessionId_nickname_key" ON "PlayerSession"("sessionId", "nickname");
CREATE UNIQUE INDEX "Challenge_order_key" ON "Challenge"("order");
CREATE UNIQUE INDEX "ChallengeAttempt_playerId_challengeId_key" ON "ChallengeAttempt"("playerId", "challengeId");

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PlayerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
