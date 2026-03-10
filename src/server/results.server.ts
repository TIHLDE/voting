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

    // Include blank votes in total for majority requirement
    const totalBallots = ballots.length;
    const totalVotes = totalBallots + blankVoteCount;
    const quota = Math.floor(totalVotes / (numberOfWinners + 1)) + 1;

    // Save quota to result
    await db
        .update(votationResult)
        .set({ quota })
        .where(eq(votationResult.votationId, votationId));

    const eliminated = new Set<string>();
    const winners = new Set<string>();
    let round = 0;
    const roundHistory: Map<string, number>[] = [];

    while (winners.size < numberOfWinners) {
        const remaining = alts.filter(
            (a) => !eliminated.has(a.id) && !winners.has(a.id),
        );

        if (remaining.length === 0) break;

        // If remaining alternatives <= seats left
        if (remaining.length <= numberOfWinners - winners.size) {
            const finalCounts = countVotes(ballots, alts, eliminated, winners);
            await saveRound(resultId, round, alts, finalCounts);

            if (numberOfWinners === 1) {
                // IRV: last candidate must still meet quota (majority)
                const lastVotes = finalCounts.get(remaining[0].id) ?? 0;
                if (lastVotes >= quota) {
                    winners.add(remaining[0].id);
                }
                // If they don't meet quota → no winner
            } else {
                // Multi-winner STV: auto-fill remaining seats
                for (const alt of remaining) {
                    winners.add(alt.id);
                }
            }
            break;
        }

        // Count votes for this round
        const voteCounts = countVotes(ballots, alts, eliminated, winners);

        // Save round with actual vote counts BEFORE processing
        await saveRound(resultId, round, alts, voteCounts);
        roundHistory.push(new Map(voteCounts));

        // Find winners this round
        const roundWinners: string[] = [];
        for (const [altId, votes] of voteCounts) {
            if (votes >= quota) {
                roundWinners.push(altId);
            }
        }

        // Process surplus redistribution for each winner
        for (const altId of roundWinners) {
            const votes = voteCounts.get(altId)!;
            const surplus = votes - quota;
            if (surplus > 0) {
                const transferWeight = surplus / votes;
                for (const ballot of ballots) {
                    const ballotTop = ballot.rankings.find(
                        (r) =>
                            !eliminated.has(r.alternativeId) &&
                            !winners.has(r.alternativeId),
                    );
                    if (ballotTop && ballotTop.alternativeId === altId) {
                        ballot.weight *= transferWeight;
                    }
                }
            }
            winners.add(altId);
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

            const seatsLeft = numberOfWinners - winners.size;
            const remainingAfterElim = remaining.length - lowestAlts.length;

            if (remainingAfterElim >= seatsLeft) {
                // Safe to eliminate all tied candidates
                for (const id of lowestAlts) {
                    eliminated.add(id);
                }
            } else if (lowestAlts.length > 1) {
                // Multiple tied and eliminating all would leave too few
                // Try to break tie using previous round history
                const toEliminate = breakTieByHistory(lowestAlts, roundHistory);
                if (toEliminate) {
                    eliminated.add(toEliminate);
                } else {
                    // Unbreakable tie that determines outcome → no winner
                    break;
                }
            } else {
                // Single candidate at bottom but can't eliminate
                // (remaining would drop below seats needed)
                break;
            }
        }

        round++;
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

/**
 * Break a tie by looking at previous rounds' vote counts.
 * Returns the ID of the candidate to eliminate (fewest votes in most recent
 * differing round), or null if the tie is unbreakable.
 */
function breakTieByHistory(
    tiedIds: string[],
    roundHistory: Map<string, number>[],
): string | null {
    for (let i = roundHistory.length - 1; i >= 0; i--) {
        const round = roundHistory[i];
        let minVotes = Infinity;
        let minId: string | null = null;
        let uniqueMin = true;

        for (const id of tiedIds) {
            const votes = round.get(id) ?? 0;
            if (votes < minVotes) {
                minVotes = votes;
                minId = id;
                uniqueMin = true;
            } else if (votes === minVotes) {
                uniqueMin = false;
            }
        }

        if (uniqueMin && minId) {
            return minId;
        }
    }

    return null;
}

function countVotes(
    ballots: StvBallot[],
    alts: Array<{ id: string }>,
    eliminated: Set<string>,
    winners: Set<string>,
): Map<string, number> {
    const voteCounts = new Map<string, number>();
    for (const alt of alts) {
        if (!eliminated.has(alt.id) && !winners.has(alt.id)) {
            voteCounts.set(alt.id, 0);
        }
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
    return voteCounts;
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
