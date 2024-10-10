-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PARTICIPANT', 'COUNTER');

-- CreateEnum
CREATE TYPE "VotationType" AS ENUM ('QUALIFIED', 'SIMPLE', 'STV');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('UPCOMING', 'ONGOING', 'ENDED');

-- CreateEnum
CREATE TYPE "VotationStatus" AS ENUM ('UPCOMING', 'OPEN', 'CHECKING_RESULT', 'PUBLISHED_RESULT', 'INVALID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'UPCOMING',
    "allowSelfRegistration" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "isVotingEligible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotationResultReview" (
    "votationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,

    CONSTRAINT "VotationResultReview_pkey" PRIMARY KEY ("votationId","participantId")
);

-- CreateTable
CREATE TABLE "Invite" (
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isVotingEligible" BOOLEAN NOT NULL,
    "meetingId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Votation" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "VotationStatus" NOT NULL DEFAULT 'UPCOMING',
    "blankVotes" BOOLEAN NOT NULL,
    "blankVoteCount" INTEGER NOT NULL DEFAULT 0,
    "hiddenVotes" BOOLEAN NOT NULL,
    "type" "VotationType" NOT NULL DEFAULT 'SIMPLE',
    "numberOfWinners" INTEGER NOT NULL DEFAULT 1,
    "majorityThreshold" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "meetingId" TEXT NOT NULL,

    CONSTRAINT "Votation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HasVoted" (
    "votationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HasVoted_pkey" PRIMARY KEY ("userId","votationId")
);

-- CreateTable
CREATE TABLE "Alternative" (
    "id" TEXT NOT NULL,
    "text" VARCHAR(120) NOT NULL,
    "index" INTEGER NOT NULL DEFAULT 0,
    "votationId" TEXT NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "winnerOfStvRoundId" TEXT,
    "loserOfStvRoundId" TEXT,

    CONSTRAINT "Alternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StvVote" (
    "id" TEXT NOT NULL,
    "votationId" TEXT NOT NULL,

    CONSTRAINT "StvVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlternativeRoundVoteCount" (
    "alterantiveId" TEXT NOT NULL,
    "voteCount" DOUBLE PRECISION NOT NULL,
    "stvRoundResultId" TEXT NOT NULL,

    CONSTRAINT "AlternativeRoundVoteCount_pkey" PRIMARY KEY ("alterantiveId","stvRoundResultId")
);

-- CreateTable
CREATE TABLE "StvRoundResult" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "stvResultId" TEXT,
    "resultId" TEXT,

    CONSTRAINT "StvRoundResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StvResult" (
    "votationId" TEXT NOT NULL,
    "quota" INTEGER NOT NULL,

    CONSTRAINT "StvResult_pkey" PRIMARY KEY ("votationId")
);

-- CreateTable
CREATE TABLE "VotationResult" (
    "votationId" TEXT NOT NULL,
    "votingEligibleCount" INTEGER NOT NULL,
    "voteCount" INTEGER NOT NULL,
    "blankVoteCount" INTEGER,
    "quota" DOUBLE PRECISION,

    CONSTRAINT "VotationResult_pkey" PRIMARY KEY ("votationId")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "alternativeId" TEXT NOT NULL,
    "ranking" INTEGER NOT NULL DEFAULT 1,
    "stvVoteId" TEXT,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_userId_meetingId_key" ON "Participant"("userId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_email_meetingId_key" ON "Invite"("email", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "StvRoundResult_index_stvResultId_key" ON "StvRoundResult"("index", "stvResultId");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotationResultReview" ADD CONSTRAINT "VotationResultReview_votationId_fkey" FOREIGN KEY ("votationId") REFERENCES "Votation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotationResultReview" ADD CONSTRAINT "VotationResultReview_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Votation" ADD CONSTRAINT "Votation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HasVoted" ADD CONSTRAINT "HasVoted_votationId_fkey" FOREIGN KEY ("votationId") REFERENCES "Votation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HasVoted" ADD CONSTRAINT "HasVoted_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_votationId_fkey" FOREIGN KEY ("votationId") REFERENCES "Votation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_winnerOfStvRoundId_fkey" FOREIGN KEY ("winnerOfStvRoundId") REFERENCES "StvRoundResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_loserOfStvRoundId_fkey" FOREIGN KEY ("loserOfStvRoundId") REFERENCES "StvRoundResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StvVote" ADD CONSTRAINT "StvVote_votationId_fkey" FOREIGN KEY ("votationId") REFERENCES "Votation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternativeRoundVoteCount" ADD CONSTRAINT "AlternativeRoundVoteCount_alterantiveId_fkey" FOREIGN KEY ("alterantiveId") REFERENCES "Alternative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternativeRoundVoteCount" ADD CONSTRAINT "AlternativeRoundVoteCount_stvRoundResultId_fkey" FOREIGN KEY ("stvRoundResultId") REFERENCES "StvRoundResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StvRoundResult" ADD CONSTRAINT "StvRoundResult_stvResultId_fkey" FOREIGN KEY ("stvResultId") REFERENCES "StvResult"("votationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StvRoundResult" ADD CONSTRAINT "StvRoundResult_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "VotationResult"("votationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StvResult" ADD CONSTRAINT "StvResult_votationId_fkey" FOREIGN KEY ("votationId") REFERENCES "Votation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotationResult" ADD CONSTRAINT "VotationResult_votationId_fkey" FOREIGN KEY ("votationId") REFERENCES "Votation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_alternativeId_fkey" FOREIGN KEY ("alternativeId") REFERENCES "Alternative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_stvVoteId_fkey" FOREIGN KEY ("stvVoteId") REFERENCES "StvVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
