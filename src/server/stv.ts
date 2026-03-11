// Pure STV (Single Transferable Vote) algorithm — no database dependencies.

export interface StvBallot {
    id: string;
    rankings: { alternativeId: string; ranking: number }[];
    weight: number;
}

export interface StvRoundData {
    roundIndex: number;
    voteCounts: Map<string, number>;
}

export interface StvAlgorithmResult {
    winners: Set<string>;
    quota: number;
    rounds: StvRoundData[];
}

export function runStvAlgorithm(
    inputBallots: StvBallot[],
    alternativeIds: string[],
    numberOfWinners: number,
    blankVoteCount: number,
): StvAlgorithmResult {
    // Deep-copy ballots so weight mutations don't affect the caller.
    const ballots: StvBallot[] = inputBallots.map((b) => ({
        ...b,
        rankings: [...b.rankings],
    }));

    const totalVotes = ballots.length + blankVoteCount;
    const quota = Math.floor(totalVotes / (numberOfWinners + 1)) + 1;

    const alts = alternativeIds.map((id) => ({ id }));
    const eliminated = new Set<string>();
    const winners = new Set<string>();
    let round = 0;
    const roundHistory: Map<string, number>[] = [];
    const rounds: StvRoundData[] = [];

    while (winners.size < numberOfWinners) {
        const remaining = alts.filter(
            (a) => !eliminated.has(a.id) && !winners.has(a.id),
        );

        if (remaining.length === 0) break;

        // If remaining candidates <= seats left, auto-fill or do final quota check.
        if (remaining.length <= numberOfWinners - winners.size) {
            const finalCounts = countVotes(ballots, alts, eliminated, winners);
            rounds.push({
                roundIndex: round,
                voteCounts: new Map(finalCounts),
            });

            if (numberOfWinners === 1) {
                // IRV: the last candidate must still meet quota (majority).
                const lastVotes = finalCounts.get(remaining[0].id) ?? 0;
                if (lastVotes >= quota) {
                    winners.add(remaining[0].id);
                }
                // If they don't meet quota → no winner.
            } else {
                // Multi-winner STV: auto-fill remaining seats.
                for (const alt of remaining) {
                    winners.add(alt.id);
                }
            }
            break;
        }

        // Count votes for this round.
        const voteCounts = countVotes(ballots, alts, eliminated, winners);
        rounds.push({ roundIndex: round, voteCounts: new Map(voteCounts) });
        roundHistory.push(new Map(voteCounts));

        // Check for round winners.
        const roundWinners: string[] = [];
        for (const [altId, votes] of voteCounts) {
            if (votes >= quota) {
                roundWinners.push(altId);
            }
        }

        // Redistribute surplus for each winner.
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

        // If no winners this round, eliminate exactly one candidate.
        // Bulk elimination is avoided: removing multiple tied candidates at once
        // skips rounds where one of them might have risen above the others after
        // transfers, potentially changing who the legitimate loser is.
        if (roundWinners.length === 0) {
            let minVotes = Infinity;
            for (const [, votes] of voteCounts) {
                if (votes < minVotes) minVotes = votes;
            }

            const lowestAlts = Array.from(voteCounts.entries())
                .filter(([, votes]) => votes === minVotes)
                .map(([id]) => id);

            const seatsLeft = numberOfWinners - winners.size;

            if (remaining.length - 1 < seatsLeft) {
                // Eliminating anyone would leave too few candidates for remaining seats.
                break;
            }

            if (lowestAlts.length === 1) {
                eliminated.add(lowestAlts[0]);
            } else {
                // Multiple candidates tied for lowest — use history to pick one.
                const toEliminate = breakTieByHistory(lowestAlts, roundHistory);
                if (toEliminate) {
                    eliminated.add(toEliminate);
                } else {
                    // Unbreakable tie → no winner.
                    break;
                }
            }
        }

        round++;
        if (round > 100) break;
    }

    return { winners, quota, rounds };
}

/**
 * Break a tie by looking at previous rounds' vote counts.
 * Returns the ID to eliminate (fewest votes in the most recent differing round),
 * or null if the tie is unbreakable.
 */
export function breakTieByHistory(
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
