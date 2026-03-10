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

interface StvBallot {
    id: string;
    rankings: { alternativeId: string; ranking: number }[];
    weight: number;
}

async function computeStvResult(
    votationId: string,
    numberOfWinners: number,
    resultId: string,
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

    const ballots: StvBallot[] = stvVotes.map((sv) => ({
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

    const totalBallots = ballots.length;
    const quota = Math.floor(totalBallots / (numberOfWinners + 1)) + 1;

    // Save quota to result
    await db
        .update(votationResult)
        .set({ quota })
        .where(eq(votationResult.votationId, votationId));

    const eliminated = new Set<string>();
    const winners = new Set<string>();
    let round = 0;

    while (winners.size < numberOfWinners) {
        const remaining = alts.filter(
            (a) => !eliminated.has(a.id) && !winners.has(a.id),
        );

        if (remaining.length === 0) break;

        // If remaining alternatives <= seats left, all win
        if (remaining.length <= numberOfWinners - winners.size) {
            for (const alt of remaining) {
                winners.add(alt.id);
            }
            // Save final round
            await saveRound(
                resultId,
                round,
                alts,
                ballots,
                eliminated,
                winners,
                Array.from(winners).filter((id) =>
                    remaining.some((a) => a.id === id),
                ),
                [],
            );
            break;
        }

        // Count votes
        const voteCounts = new Map<string, number>();
        for (const alt of remaining) {
            voteCounts.set(alt.id, 0);
        }

        for (const ballot of ballots) {
            const topChoice = ballot.rankings.find(
                (r) =>
                    !eliminated.has(r.alternativeId) &&
                    !winners.has(r.alternativeId),
            );
            if (topChoice) {
                voteCounts.set(
                    topChoice.alternativeId,
                    (voteCounts.get(topChoice.alternativeId) ?? 0) +
                        ballot.weight,
                );
            }
        }

        // Check for winners
        const roundWinners: string[] = [];
        const roundLosers: string[] = [];

        for (const [altId, votes] of voteCounts) {
            if (votes >= quota) {
                winners.add(altId);
                roundWinners.push(altId);

                // Redistribute surplus
                const surplus = votes - quota;
                if (surplus > 0) {
                    const transferWeight = surplus / votes;
                    for (const ballot of ballots) {
                        const topChoice = ballot.rankings.find(
                            (r) =>
                                !eliminated.has(r.alternativeId) &&
                                !winners.has(r.alternativeId),
                        );
                        const currentTop = ballot.rankings.find(
                            (r) => r.alternativeId === altId,
                        );
                        if (currentTop && topChoice) {
                            ballot.weight *= transferWeight;
                        }
                    }
                }
            }
        }

        // If no winners this round, eliminate the lowest
        if (roundWinners.length === 0) {
            let minVotes = Infinity;
            for (const [, votes] of voteCounts) {
                if (votes < minVotes) minVotes = votes;
            }

            const lowestAlts = Array.from(voteCounts.entries())
                .filter(([, votes]) => votes === minVotes)
                .map(([id]) => id);

            // If eliminating all tied losers would leave too few, keep some
            const seatsLeft = numberOfWinners - winners.size;
            const remainingAfterElim = remaining.length - lowestAlts.length;

            if (remainingAfterElim < seatsLeft) {
                // Only eliminate enough
                const canEliminate = remaining.length - seatsLeft;
                for (
                    let i = 0;
                    i < canEliminate && i < lowestAlts.length;
                    i++
                ) {
                    eliminated.add(lowestAlts[i]);
                    roundLosers.push(lowestAlts[i]);
                }
            } else {
                for (const id of lowestAlts) {
                    eliminated.add(id);
                    roundLosers.push(id);
                }
            }
        }

        await saveRound(
            resultId,
            round,
            alts,
            ballots,
            eliminated,
            winners,
            roundWinners,
            roundLosers,
        );

        round++;

        // Safety limit
        if (round > 100) break;
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
    ballots: StvBallot[],
    eliminated: Set<string>,
    winners: Set<string>,
    _roundWinners: string[],
    _roundLosers: string[],
) {
    // Count current votes for this round
    const voteCounts = new Map<string, number>();
    for (const alt of alts) {
        voteCounts.set(alt.id, 0);
    }

    for (const ballot of ballots) {
        const topChoice = ballot.rankings.find(
            (r) =>
                !eliminated.has(r.alternativeId) &&
                !winners.has(r.alternativeId),
        );
        if (topChoice) {
            voteCounts.set(
                topChoice.alternativeId,
                (voteCounts.get(topChoice.alternativeId) ?? 0) + ballot.weight,
            );
        }
    }

    const [roundResult] = await db
        .insert(stvRoundResult)
        .values({
            index: roundIndex,
            resultId,
        })
        .returning();

    const voteCountEntries = Array.from(voteCounts.entries()).filter(
        ([altId]) => !eliminated.has(altId) || alts.some((a) => a.id === altId),
    );

    if (voteCountEntries.length > 0) {
        await db.insert(alternativeRoundVoteCount).values(
            voteCountEntries.map(([altId, voteCount]) => ({
                alternativeId: altId,
                voteCount,
                stvRoundResultId: roundResult.id,
            })),
        );
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
            );
            break;
    }
}
