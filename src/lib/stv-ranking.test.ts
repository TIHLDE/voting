import { describe, expect, test } from 'vite-plus/test';
import {
    moveRankingItem,
    renumberRanking,
    validateStvRanking,
} from './stv-ranking';
import type { StvRanking } from './stv-ranking';

function ranked(...alternativeIds: string[]): StvRanking[] {
    return alternativeIds.map((alternativeId, index) => ({
        alternativeId,
        ranking: index + 1,
    }));
}

describe('renumberRanking', () => {
    test('assigns rankings from 1 in list order', () => {
        expect(
            renumberRanking([
                { alternativeId: 'a', ranking: 3 },
                { alternativeId: 'b', ranking: 7 },
            ]),
        ).toEqual(ranked('a', 'b'));
    });
});

describe('moveRankingItem', () => {
    test('moves an item up and renumbers', () => {
        expect(moveRankingItem(ranked('a', 'b', 'c'), 1, -1)).toEqual(
            ranked('b', 'a', 'c'),
        );
    });

    test('moves an item down and renumbers', () => {
        expect(moveRankingItem(ranked('a', 'b', 'c'), 1, 1)).toEqual(
            ranked('a', 'c', 'b'),
        );
    });

    test('does nothing when moving the first item up', () => {
        const ranking = ranked('a', 'b');
        expect(moveRankingItem(ranking, 0, -1)).toBe(ranking);
    });

    test('does nothing when moving the last item down', () => {
        const ranking = ranked('a', 'b');
        expect(moveRankingItem(ranking, 1, 1)).toBe(ranking);
    });

    test('does not mutate the input', () => {
        const ranking = ranked('a', 'b');
        moveRankingItem(ranking, 0, 1);
        expect(ranking).toEqual(ranked('a', 'b'));
    });
});

describe('validateStvRanking', () => {
    const alternativeIds = ['a', 'b', 'c'];

    test('accepts a complete ranking in any order', () => {
        expect(
            validateStvRanking(ranked('c', 'a', 'b'), alternativeIds),
        ).toBeNull();
    });

    test('rejects an empty ballot', () => {
        expect(validateStvRanking([], alternativeIds)).toBe(
            'Du må rangere alle alternativene før du kan avgi stemme',
        );
    });

    test('rejects a partial ranking', () => {
        expect(validateStvRanking(ranked('a', 'b'), alternativeIds)).toBe(
            'Du må rangere alle alternativene før du kan avgi stemme',
        );
    });

    test('rejects duplicate alternatives', () => {
        expect(validateStvRanking(ranked('a', 'b', 'a'), alternativeIds)).toBe(
            'Et alternativ kan bare rangeres én gang',
        );
    });

    test('rejects unknown alternatives', () => {
        expect(validateStvRanking(ranked('a', 'b', 'x'), alternativeIds)).toBe(
            'Stemmen inneholder et alternativ som ikke finnes i voteringen',
        );
    });

    test('rejects duplicate ranking numbers', () => {
        expect(
            validateStvRanking(
                [
                    { alternativeId: 'a', ranking: 1 },
                    { alternativeId: 'b', ranking: 1 },
                    { alternativeId: 'c', ranking: 2 },
                ],
                alternativeIds,
            ),
        ).toBe('Ugyldig rangering');
    });

    test('rejects ranking numbers outside 1..n', () => {
        expect(
            validateStvRanking(
                [
                    { alternativeId: 'a', ranking: 0 },
                    { alternativeId: 'b', ranking: 1 },
                    { alternativeId: 'c', ranking: 2 },
                ],
                alternativeIds,
            ),
        ).toBe('Ugyldig rangering');
        expect(
            validateStvRanking(
                [
                    { alternativeId: 'a', ranking: 1.5 },
                    { alternativeId: 'b', ranking: 2 },
                    { alternativeId: 'c', ranking: 3 },
                ],
                alternativeIds,
            ),
        ).toBe('Ugyldig rangering');
    });
});
