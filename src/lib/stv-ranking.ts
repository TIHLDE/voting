export type StvRanking = { alternativeId: string; ranking: number };

/** Assigns rankings 1..n based on the order of the list. */
export function renumberRanking(ranking: StvRanking[]): StvRanking[] {
    return ranking.map((item, index) => ({ ...item, ranking: index + 1 }));
}

/** Swaps the item at `index` with its neighbour above (-1) or below (+1). */
export function moveRankingItem(
    ranking: StvRanking[],
    index: number,
    direction: -1 | 1,
): StvRanking[] {
    const target = index + direction;
    if (
        index < 0 ||
        index >= ranking.length ||
        target < 0 ||
        target >= ranking.length
    ) {
        return ranking;
    }

    const moved = [...ranking];
    [moved[index], moved[target]] = [moved[target], moved[index]];
    return renumberRanking(moved);
}

/**
 * Validates that an STV ballot ranks every alternative exactly once with
 * rankings 1..n. Returns an error message, or null if the ballot is valid.
 * Blank votes are cast separately and never reach this check.
 */
export function validateStvRanking(
    ranking: StvRanking[],
    alternativeIds: string[],
): string | null {
    const validIds = new Set(alternativeIds);
    const rankedIds = new Set<string>();
    const usedRankings = new Set<number>();

    for (const item of ranking) {
        if (!validIds.has(item.alternativeId)) {
            return 'Stemmen inneholder et alternativ som ikke finnes i voteringen';
        }
        if (rankedIds.has(item.alternativeId)) {
            return 'Et alternativ kan bare rangeres én gang';
        }
        rankedIds.add(item.alternativeId);
    }

    if (rankedIds.size !== validIds.size) {
        return 'Du må rangere alle alternativene før du kan avgi stemme';
    }

    for (const item of ranking) {
        if (
            !Number.isInteger(item.ranking) ||
            item.ranking < 1 ||
            item.ranking > ranking.length ||
            usedRankings.has(item.ranking)
        ) {
            return 'Ugyldig rangering';
        }
        usedRankings.add(item.ranking);
    }

    return null;
}
