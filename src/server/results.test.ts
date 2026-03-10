import { describe, expect, test } from 'bun:test';
import { runStvAlgorithm, breakTieByHistory } from './stv.ts';
import type { StvBallot } from './stv.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ballot(id: string, ...preferences: string[]): StvBallot {
    return {
        id,
        rankings: preferences.map((alternativeId, i) => ({
            alternativeId,
            ranking: i + 1,
        })),
        weight: 1,
    };
}

// ---------------------------------------------------------------------------
// Scenario 1: Quota with blank votes → no winner (deadlock)
// ---------------------------------------------------------------------------

describe('Scenario 1: Quota with blank votes', () => {
    // 2 voters + 1 blank vote = 3 total.
    // quota = floor(3 / (1+1)) + 1 = 2
    // voter1 prefers A>B, voter2 prefers B>A → each gets 1 vote, neither reaches quota 2.

    const ballots: StvBallot[] = [
        ballot('voter1', 'optionA', 'optionB'),
        ballot('voter2', 'optionB', 'optionA'),
    ];
    const blankVoteCount = 1;

    test('quota is calculated as floor(3/2)+1 = 2', () => {
        const { quota } = runStvAlgorithm(
            ballots,
            ['optionA', 'optionB'],
            1,
            blankVoteCount,
        );
        expect(quota).toBe(2);
    });

    test('neither optionA nor optionB reaches the quota', () => {
        const { winners, rounds } = runStvAlgorithm(
            ballots,
            ['optionA', 'optionB'],
            1,
            blankVoteCount,
        );
        const round0 = rounds[0]?.voteCounts;
        expect(round0?.get('optionA')).toBe(1);
        expect(round0?.get('optionB')).toBe(1);
        expect(winners.has('optionA')).toBe(false);
        expect(winners.has('optionB')).toBe(false);
    });

    test('result is no winner instead of a random pick', () => {
        const { winners } = runStvAlgorithm(
            ballots,
            ['optionA', 'optionB'],
            1,
            blankVoteCount,
        );
        expect(winners.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Scenario 2: Tie-breaking via history → unbreakable tie → no winner
// ---------------------------------------------------------------------------

describe('Scenario 2: Tie-breaking via history', () => {
    // 3 options: optionB, optionC, optionD. 14 ballots, 0 blank.
    // 5 voters rank B>C>D, 5 voters rank C>B>D.
    // 2 voters rank D>B>C, 2 voters rank D>C>B (D voters split evenly).
    // quota = floor(14/2)+1 = 8
    //
    // Round 1: B=5, C=5, D=4 → D eliminated (sole lowest).
    // D's votes transfer: 2 to B, 2 to C.
    // Round 2: B=7, C=7 → tie; breakTieByHistory checks round 1 (B=5, C=5) → still tied → null → no winner.

    const ballots: StvBallot[] = [
        ...Array.from({ length: 5 }, (_, i) =>
            ballot(`voterB${i}`, 'optionB', 'optionC', 'optionD'),
        ),
        ...Array.from({ length: 5 }, (_, i) =>
            ballot(`voterC${i}`, 'optionC', 'optionB', 'optionD'),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
            ballot(`voterDB${i}`, 'optionD', 'optionB', 'optionC'),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
            ballot(`voterDC${i}`, 'optionD', 'optionC', 'optionB'),
        ),
    ];

    test('quota is 8', () => {
        const { quota } = runStvAlgorithm(
            ballots,
            ['optionB', 'optionC', 'optionD'],
            1,
            0,
        );
        expect(quota).toBe(8);
    });

    test('two rounds are recorded before giving up', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            ['optionB', 'optionC', 'optionD'],
            1,
            0,
        );
        // Round 0 (B=5, C=5, D=4) and round 1 (B=7, C=7 after D eliminated)
        expect(rounds.length).toBe(2);
    });

    test('round 1 shows optionB and optionC both at 7 votes (tie)', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            ['optionB', 'optionC', 'optionD'],
            1,
            0,
        );
        const round1 = rounds[1]?.voteCounts;
        expect(round1?.get('optionB')).toBe(7);
        expect(round1?.get('optionC')).toBe(7);
    });

    test('breakTieByHistory returns null when all rounds are identical', () => {
        // Both rounds have B=5, C=5 for the tied candidates → unbreakable.
        const history: Map<string, number>[] = [
            new Map([
                ['optionB', 5],
                ['optionC', 5],
                ['optionD', 4],
            ]),
            new Map([
                ['optionB', 7],
                ['optionC', 7],
            ]),
        ];
        expect(breakTieByHistory(['optionB', 'optionC'], history)).toBeNull();
    });

    test('no winner is declared instead of a random guess', () => {
        const { winners } = runStvAlgorithm(
            ballots,
            ['optionB', 'optionC', 'optionD'],
            1,
            0,
        );
        expect(winners.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Scenario 3: Single remaining candidate does not meet quota → no winner
// ---------------------------------------------------------------------------

describe('Scenario 3: Last candidate below quota', () => {
    // 1 candidate (optionA), 40 voters all rank optionA, 60 blank votes.
    // Total = 100, quota = floor(100/2)+1 = 51.
    // optionA gets 40 < 51 → no winner even though optionA is the only candidate.

    const ballots: StvBallot[] = Array.from({ length: 40 }, (_, i) =>
        ballot(`voter${i}`, 'optionA'),
    );
    const blankVoteCount = 60;

    test('quota is 51', () => {
        const { quota } = runStvAlgorithm(
            ballots,
            ['optionA'],
            1,
            blankVoteCount,
        );
        expect(quota).toBe(51);
    });

    test('optionA receives 40 votes in the final count', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            ['optionA'],
            1,
            blankVoteCount,
        );
        const finalRound = rounds[rounds.length - 1]?.voteCounts;
        expect(finalRound?.get('optionA')).toBe(40);
    });

    test('optionA does not win because 40 < quota of 51', () => {
        const { winners } = runStvAlgorithm(
            ballots,
            ['optionA'],
            1,
            blankVoteCount,
        );
        expect(winners.has('optionA')).toBe(false);
        expect(winners.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Sanity check: normal IRV where a winner exists
// ---------------------------------------------------------------------------

describe('Sanity: clear IRV winner', () => {
    // 10 ballots: 6 rank A>B, 4 rank B>A. quota = floor(10/2)+1 = 6. optionA wins immediately.
    const ballots: StvBallot[] = [
        ...Array.from({ length: 6 }, (_, i) =>
            ballot(`voterA${i}`, 'optionA', 'optionB'),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
            ballot(`voterB${i}`, 'optionB', 'optionA'),
        ),
    ];

    test('optionA wins with exactly the quota', () => {
        const { winners, quota } = runStvAlgorithm(
            ballots,
            ['optionA', 'optionB'],
            1,
            0,
        );
        expect(quota).toBe(6);
        expect(winners.has('optionA')).toBe(true);
        expect(winners.size).toBe(1);
    });
});
