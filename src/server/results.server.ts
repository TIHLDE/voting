import { eq, and, count, asc, ne } from 'drizzle-orm';
import {
    votation,
    alternative,
    vote,
    stvVote,
    participant,
    hasVoted,
    votationResult,
    stvRoundResult,
    alternativeRoundVoteCount,
} from '#/db/schema.ts';
import { db } from '#/db/index.ts';
import { runStvAlgorithm } from '#/server/stv.ts';

// ---------------------------------------------------------------------------
// Simple majority
// ---------------------------------------------------------------------------

async function computeSimpleResult(votationId: string) {
    const alts = await db.query.alternative.findMany({
        where: eq(alternative.votationId, votationId),
        with: { votes: true },
    });

    let maxVotes = 0;
    for (const alt of alts) {
        if (alt.votes.length > maxVotes) {
            maxVotes = alt.votes.length;
        }
    }

    // Only mark winner if there's no tie at the top
    const winners = alts.filter((alt) => alt.votes.length === maxVotes);
    if (winners.length === 1) {
        await db
            .update(alternative)
            .set({ isWinner: true })
            .where(eq(alternative.id, winners[0].id));
    }
}

// ---------------------------------------------------------------------------
// Qualified majority
// ---------------------------------------------------------------------------

async function computeQualifiedResult(
    votationId: string,
    threshold: number,
    eligibleCount: number,
) {
    const alts = await db.query.alternative.findMany({
        where: eq(alternative.votationId, votationId),
        with: { votes: true },
    });

    const requiredVotes = (eligibleCount * threshold) / 100;

    for (const alt of alts) {
        if (alt.votes.length > requiredVotes) {
            await db
                .update(alternative)
                .set({ isWinner: true })
                .where(eq(alternative.id, alt.id));
        }
    }
}

// ---------------------------------------------------------------------------
// STV (Single Transferable Vote) - Droop Quota
// ---------------------------------------------------------------------------

async function computeStvResult(
    votationId: string,
    numberOfWinners: number,
    resultId: string,
    blankVoteCount: number,
) {
    // Load all STV ballots
    const stvVotes = await db.query.stvVote.findMany({
        where: eq(stvVote.votationId, votationId),
        with: {
            votes: {
                orderBy: [asc(vote.ranking)],
            },
        },
    });

    const ballots = stvVotes.map((sv) => ({
        id: sv.id,
        rankings: sv.votes.map((v) => ({
            alternativeId: v.alternativeId,
            ranking: v.ranking,
        })),
        weight: 1,
    }));

    const alts = await db.query.alternative.findMany({
        where: eq(alternative.votationId, votationId),
    });

    const { winners, quota, rounds } = runStvAlgorithm(
        ballots,
        alts.map((a) => a.id),
        numberOfWinners,
        blankVoteCount,
    );

    // Persist quota
    await db
        .update(votationResult)
        .set({ quota })
        .where(eq(votationResult.votationId, votationId));

    // Persist rounds
    for (const { roundIndex, voteCounts } of rounds) {
        await saveRound(resultId, roundIndex, alts, voteCounts);
    }

    // Mark winners in alternatives
    for (const winnerId of winners) {
        await db
            .update(alternative)
            .set({ isWinner: true })
            .where(eq(alternative.id, winnerId));
    }
}

async function saveRound(
    resultId: string,
    roundIndex: number,
    alts: Array<{ id: string }>,
    voteCounts: Map<string, number>,
) {
    const [roundResult] = await db
        .insert(stvRoundResult)
        .values({
            index: roundIndex,
            resultId,
        })
        .returning();

    const entries = alts
        .filter((alt) => voteCounts.has(alt.id))
        .map((alt) => ({
            alternativeId: alt.id,
            voteCount: voteCounts.get(alt.id) ?? 0,
            stvRoundResultId: roundResult.id,
        }));

    if (entries.length > 0) {
        await db.insert(alternativeRoundVoteCount).values(entries);
    }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function setWinner(votationId: string) {
    const v = await db.query.votation.findFirst({
        where: eq(votation.id, votationId),
    });
    if (!v) throw new Error('Voteringen finnes ikke');

    // Skip if already computed
    const existingResult = await db.query.votationResult.findFirst({
        where: eq(votationResult.votationId, votationId),
    });
    if (existingResult) return;

    // Count eligible voters (exclude admins)
    const [eligibleResult] = await db
        .select({ count: count() })
        .from(participant)
        .where(
            and(
                eq(participant.meetingId, v.meetingId),
                eq(participant.isVotingEligible, true),
                eq(participant.isApproved, true),
                ne(participant.role, 'ADMIN'),
            ),
        );

    // Count votes
    const [voteCountResult] = await db
        .select({ count: count() })
        .from(hasVoted)
        .where(eq(hasVoted.votationId, votationId));

    // Create result snapshot
    const [result] = await db
        .insert(votationResult)
        .values({
            votationId,
            votingEligibleCount: eligibleResult.count,
            voteCount: voteCountResult.count,
            blankVoteCount: v.blankVotes ? v.blankVoteCount : null,
        })
        .returning();

    // Compute based on type
    switch (v.type) {
        case 'SIMPLE':
            await computeSimpleResult(votationId);
            break;
        case 'QUALIFIED':
            await computeQualifiedResult(
                votationId,
                v.majorityThreshold,
                eligibleResult.count,
            );
            break;
        case 'STV':
            await computeStvResult(
                votationId,
                v.numberOfWinners,
                result.votationId,
                v.blankVoteCount,
            );
            break;
    }
}
