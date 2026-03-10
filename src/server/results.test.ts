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
// Scenario 4: Large election — 4 candidates, multi-round elimination, near-miss
// ---------------------------------------------------------------------------

describe('Scenario 4: Large election with blank votes — 4-round elimination, no winner', () => {
    // 4 candidates: optionA, optionB, optionC, optionD
    // 290 blank votes, 290 real voters split across four preference groups.
    // Total = 580 → quota = floor(580/2)+1 = 291
    //
    // Preference groups:
    //   100 voters: A > B > C > D
    //    80 voters: B > A > C > D
    //    60 voters: C > D > A > B
    //    50 voters: D > C > B > A
    //
    // Round 1: A=100, B=80, C=60, D=50  → D eliminated (sole lowest)
    //          D's 50 ballots next-prefer C  → C gains 50
    // Round 2: A=100, B=80, C=110       → B eliminated (sole lowest: 80)
    //          B's 80 ballots next-prefer A  → A gains 80
    // Round 3: A=180, C=110             → C eliminated (sole lowest: 110)
    //          C's 110 ballots next-prefer D (eliminated) then A → A gains 110
    // Round 4: A=290 (sole candidate)   → 290 < quota 291 → NO WINNER

    const ballots: StvBallot[] = [
        ...Array.from({ length: 100 }, (_, i) =>
            ballot(`voterA${i}`, 'optionA', 'optionB', 'optionC', 'optionD'),
        ),
        ...Array.from({ length: 80 }, (_, i) =>
            ballot(`voterB${i}`, 'optionB', 'optionA', 'optionC', 'optionD'),
        ),
        ...Array.from({ length: 60 }, (_, i) =>
            ballot(`voterC${i}`, 'optionC', 'optionD', 'optionA', 'optionB'),
        ),
        ...Array.from({ length: 50 }, (_, i) =>
            ballot(`voterD${i}`, 'optionD', 'optionC', 'optionB', 'optionA'),
        ),
    ];
    const blankVoteCount = 290;
    const candidates = ['optionA', 'optionB', 'optionC', 'optionD'];

    test('quota is 291 (floor(580/2)+1)', () => {
        const { quota } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(quota).toBe(291);
    });

    test('round 1: A=100, B=80, C=60, D=50', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[0]?.voteCounts;
        expect(vc?.get('optionA')).toBe(100);
        expect(vc?.get('optionB')).toBe(80);
        expect(vc?.get('optionC')).toBe(60);
        expect(vc?.get('optionD')).toBe(50);
    });

    test('round 2: D eliminated, C absorbs D votes → A=100, B=80, C=110', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[1]?.voteCounts;
        expect(vc?.get('optionA')).toBe(100);
        expect(vc?.get('optionB')).toBe(80);
        expect(vc?.get('optionC')).toBe(110);
        expect(vc?.get('optionD')).toBeUndefined();
    });

    test('round 3: B eliminated, A absorbs B votes → A=180, C=110', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[2]?.voteCounts;
        expect(vc?.get('optionA')).toBe(180);
        expect(vc?.get('optionC')).toBe(110);
        expect(vc?.get('optionB')).toBeUndefined();
    });

    test('round 4: C eliminated, A absorbs all C votes → A=290 (sole candidate)', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[3]?.voteCounts;
        expect(vc?.get('optionA')).toBe(290);
        expect(vc?.get('optionC')).toBeUndefined();
    });

    test('4 rounds are recorded total', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(rounds.length).toBe(4);
    });

    test('optionA finishes 1 vote short of quota (290 < 291) — no winner', () => {
        const { winners } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(winners.has('optionA')).toBe(false);
        expect(winners.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Scenario 5: Large election — winner reaches quota through vote transfers
// ---------------------------------------------------------------------------

describe('Scenario 5: Large election — winner emerges via transfers', () => {
    // 4 candidates: optionA, optionB, optionC, optionD. 500 total, 0 blank.
    // quota = floor(500/2)+1 = 251
    //
    //   200 voters: A > B > C > D
    //   120 voters: B > A > C > D
    //   100 voters: C > A > B > D
    //    80 voters: D > A > B > C
    //
    // Round 1: A=200, B=120, C=100, D=80 → D eliminated (sole lowest)
    //          D's 80 voters prefer A next → A gains 80
    // Round 2: A=280, B=120, C=100 → A=280 ≥ quota 251 → A WINS

    const ballots: StvBallot[] = [
        ...Array.from({ length: 200 }, (_, i) =>
            ballot(`voterA${i}`, 'optionA', 'optionB', 'optionC', 'optionD'),
        ),
        ...Array.from({ length: 120 }, (_, i) =>
            ballot(`voterB${i}`, 'optionB', 'optionA', 'optionC', 'optionD'),
        ),
        ...Array.from({ length: 100 }, (_, i) =>
            ballot(`voterC${i}`, 'optionC', 'optionA', 'optionB', 'optionD'),
        ),
        ...Array.from({ length: 80 }, (_, i) =>
            ballot(`voterD${i}`, 'optionD', 'optionA', 'optionB', 'optionC'),
        ),
    ];
    const candidates = ['optionA', 'optionB', 'optionC', 'optionD'];

    test('quota is 251 (floor(500/2)+1)', () => {
        const { quota } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(quota).toBe(251);
    });

    test('round 1: A=200, B=120, C=100, D=80', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[0]?.voteCounts;
        expect(vc?.get('optionA')).toBe(200);
        expect(vc?.get('optionB')).toBe(120);
        expect(vc?.get('optionC')).toBe(100);
        expect(vc?.get('optionD')).toBe(80);
    });

    test('round 2: D eliminated, A absorbs D votes → A=280, B=120, C=100', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[1]?.voteCounts;
        expect(vc?.get('optionA')).toBe(280);
        expect(vc?.get('optionB')).toBe(120);
        expect(vc?.get('optionC')).toBe(100);
        expect(vc?.get('optionD')).toBeUndefined();
    });

    test('exactly 2 rounds are recorded', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(rounds.length).toBe(2);
    });

    test('optionA wins with 280 votes (≥ quota 251)', () => {
        const { winners } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(winners.has('optionA')).toBe(true);
        expect(winners.size).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Scenario 6: Large election — blank-vote majority, consolidation still fails
// ---------------------------------------------------------------------------

describe('Scenario 6: Large election — all real votes consolidate but fall 1 short of quota', () => {
    // 3 candidates: optionA, optionB, optionC. 350 real + 350 blank = 700 total.
    // quota = floor(700/2)+1 = 351
    //
    //   150 voters: A > B > C
    //   120 voters: B > C > A
    //    80 voters: C > B > A
    //   350 blank votes
    //
    // Round 1: A=150, B=120, C=80 → C eliminated (sole lowest)
    //          C's 80 voters prefer B next → B gains 80
    // Round 2: A=150, B=200 → A eliminated (sole lowest: 150)
    //          A's 150 voters prefer B next → B gains 150
    // Round 3: B=350 (sole candidate) → 350 < quota 351 → NO WINNER

    const ballots: StvBallot[] = [
        ...Array.from({ length: 150 }, (_, i) =>
            ballot(`voterA${i}`, 'optionA', 'optionB', 'optionC'),
        ),
        ...Array.from({ length: 120 }, (_, i) =>
            ballot(`voterB${i}`, 'optionB', 'optionC', 'optionA'),
        ),
        ...Array.from({ length: 80 }, (_, i) =>
            ballot(`voterC${i}`, 'optionC', 'optionB', 'optionA'),
        ),
    ];
    const blankVoteCount = 350;
    const candidates = ['optionA', 'optionB', 'optionC'];

    test('quota is 351 (floor(700/2)+1)', () => {
        const { quota } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(quota).toBe(351);
    });

    test('round 1: A=150, B=120, C=80', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[0]?.voteCounts;
        expect(vc?.get('optionA')).toBe(150);
        expect(vc?.get('optionB')).toBe(120);
        expect(vc?.get('optionC')).toBe(80);
    });

    test('round 2: C eliminated, B absorbs C votes → A=150, B=200', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[1]?.voteCounts;
        expect(vc?.get('optionA')).toBe(150);
        expect(vc?.get('optionB')).toBe(200);
        expect(vc?.get('optionC')).toBeUndefined();
    });

    test('round 3: A eliminated, B absorbs A votes → B=350 (sole candidate)', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[2]?.voteCounts;
        expect(vc?.get('optionB')).toBe(350);
        expect(vc?.get('optionA')).toBeUndefined();
    });

    test('exactly 3 rounds are recorded', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(rounds.length).toBe(3);
    });

    test('optionB consolidates all 350 real votes but falls 1 short of quota — no winner', () => {
        const { winners } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(winners.has('optionB')).toBe(false);
        expect(winners.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Scenario 7: Large election — unbreakable tie, no winner
// ---------------------------------------------------------------------------

describe('Scenario 7: Large election — unbreakable tie after elimination', () => {
    // 3 candidates: optionA, optionB, optionC. 800 total, 0 blank.
    // quota = floor(800/2)+1 = 401
    //
    //   300 voters: A > C > B
    //   300 voters: B > C > A
    //   100 voters: C > A > B  (transfer to A when C eliminated)
    //   100 voters: C > B > A  (transfer to B when C eliminated)
    //
    // Round 1: A=300, B=300, C=200 → C eliminated (sole lowest)
    //          C's votes split evenly: 100 to A, 100 to B
    // Round 2: A=400, B=400 → tie for elimination
    //          History check: round 1 had A=300, B=300 → also tied
    //          breakTieByHistory returns null → unbreakable → NO WINNER

    const ballots: StvBallot[] = [
        ...Array.from({ length: 300 }, (_, i) =>
            ballot(`voterAC${i}`, 'optionA', 'optionC', 'optionB'),
        ),
        ...Array.from({ length: 300 }, (_, i) =>
            ballot(`voterBC${i}`, 'optionB', 'optionC', 'optionA'),
        ),
        ...Array.from({ length: 100 }, (_, i) =>
            ballot(`voterCA${i}`, 'optionC', 'optionA', 'optionB'),
        ),
        ...Array.from({ length: 100 }, (_, i) =>
            ballot(`voterCB${i}`, 'optionC', 'optionB', 'optionA'),
        ),
    ];
    const candidates = ['optionA', 'optionB', 'optionC'];

    test('quota is 401 (floor(800/2)+1)', () => {
        const { quota } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(quota).toBe(401);
    });

    test('round 1: A=300, B=300, C=200', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[0]?.voteCounts;
        expect(vc?.get('optionA')).toBe(300);
        expect(vc?.get('optionB')).toBe(300);
        expect(vc?.get('optionC')).toBe(200);
    });

    test('round 2: C eliminated, splits evenly → A=400, B=400', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[1]?.voteCounts;
        expect(vc?.get('optionA')).toBe(400);
        expect(vc?.get('optionB')).toBe(400);
        expect(vc?.get('optionC')).toBeUndefined();
    });

    test('exactly 2 rounds are recorded before giving up', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(rounds.length).toBe(2);
    });

    test('breakTieByHistory returns null — A and B tied in every round', () => {
        const history: Map<string, number>[] = [
            new Map([
                ['optionA', 300],
                ['optionB', 300],
                ['optionC', 200],
            ]),
            new Map([
                ['optionA', 400],
                ['optionB', 400],
            ]),
        ];
        expect(breakTieByHistory(['optionA', 'optionB'], history)).toBeNull();
    });

    test('no winner declared — tie is unresolvable', () => {
        const { winners } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(winners.has('optionA')).toBe(false);
        expect(winners.has('optionB')).toBe(false);
        expect(winners.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Scenario 8: Maximum-depth stress test — 8 candidates, 12 voter groups,
//             complex cascading transfers across all 8 rounds, no winner
// ---------------------------------------------------------------------------

describe('Scenario 8: 8-candidate stress test — full cascade, 8 rounds, no winner', () => {
    // 12 voter groups with varied cross-cutting preferences (475 real voters).
    // 525 blank votes → total 1000 → quota = floor(1000/2)+1 = 501.
    // Since max any candidate can accumulate is 475 (all real votes), nobody
    // can ever reach 501 — the algorithm must run all the way to the last
    // candidate and still declare no winner.
    //
    // Voter groups:
    //   80 voters: A > D > G > B > C > F > H > E   (Group 1)
    //   70 voters: B > E > H > A > D > G > C > F   (Group 2)
    //   65 voters: C > F > A > B > E > H > D > G   (Group 3)
    //   55 voters: D > G > C > E > B > F > A > H   (Group 4)
    //   45 voters: E > H > B > D > F > A > G > C   (Group 5)
    //   40 voters: F > C > D > A > H > E > B > G   (Group 6)
    //   30 voters: G > A > F > H > C > D > E > B   (Group 7)
    //   25 voters: H > B > E > G > A > C > F > D   (Group 8)
    //   20 voters: A > C > E > G > B > D > F > H   (Group 9)
    //   18 voters: B > D > F > H > A > C > E > G   (Group 10)
    //   15 voters: C > E > G > A > B > D > F > H   (Group 11)
    //   12 voters: D > F > H > B > C > E > G > A   (Group 12)
    //                                    Total = 475 real votes
    //
    // Elimination order and cascades:
    //   R0:  A=100 B=88  C=80  D=67  E=45  F=40  G=30  H=25  → H eliminated
    //        H(25)→B (Group8: H>B>…)
    //   R1:  A=100 B=113 C=80  D=67  E=45  F=40  G=30         → G eliminated
    //        G(30)→A (Group7: G>A>…, skip H)
    //   R2:  A=130 B=113 C=80  D=67  E=45  F=40               → F eliminated
    //        F(40)→C (Group6: F>C>…)
    //   R3:  A=130 B=113 C=120 D=67  E=45                     → E eliminated
    //        E(45)→B (Group5: E>H>B>…, skip H)
    //   R4:  A=130 B=158 C=120 D=67                           → D eliminated
    //        Group4(55): D>G>C→C   Group12(12): D>F>H>B→B
    //   R5:  A=130 B=170 C=175                                → A eliminated
    //        Group1(80): A>D>G>B→B   Group9(20): A>C→C   Group7(30): G>A>F>H>C→C
    //   R6:  B=250 C=225                                      → C eliminated (final 2)
    //        all 225 C-ballots → B (every group's next active pref is B)
    //   R7:  B=475  →  475 < quota 501  →  NO WINNER

    const candidates = [
        'optionA',
        'optionB',
        'optionC',
        'optionD',
        'optionE',
        'optionF',
        'optionG',
        'optionH',
    ];
    const blankVoteCount = 525;

    const ballots: StvBallot[] = [
        // Group 1 – 80 voters: A > D > G > B > C > F > H > E
        ...Array.from({ length: 80 }, (_, i) =>
            ballot(
                `g1v${i}`,
                'optionA',
                'optionD',
                'optionG',
                'optionB',
                'optionC',
                'optionF',
                'optionH',
                'optionE',
            ),
        ),
        // Group 2 – 70 voters: B > E > H > A > D > G > C > F
        ...Array.from({ length: 70 }, (_, i) =>
            ballot(
                `g2v${i}`,
                'optionB',
                'optionE',
                'optionH',
                'optionA',
                'optionD',
                'optionG',
                'optionC',
                'optionF',
            ),
        ),
        // Group 3 – 65 voters: C > F > A > B > E > H > D > G
        ...Array.from({ length: 65 }, (_, i) =>
            ballot(
                `g3v${i}`,
                'optionC',
                'optionF',
                'optionA',
                'optionB',
                'optionE',
                'optionH',
                'optionD',
                'optionG',
            ),
        ),
        // Group 4 – 55 voters: D > G > C > E > B > F > A > H
        ...Array.from({ length: 55 }, (_, i) =>
            ballot(
                `g4v${i}`,
                'optionD',
                'optionG',
                'optionC',
                'optionE',
                'optionB',
                'optionF',
                'optionA',
                'optionH',
            ),
        ),
        // Group 5 – 45 voters: E > H > B > D > F > A > G > C
        ...Array.from({ length: 45 }, (_, i) =>
            ballot(
                `g5v${i}`,
                'optionE',
                'optionH',
                'optionB',
                'optionD',
                'optionF',
                'optionA',
                'optionG',
                'optionC',
            ),
        ),
        // Group 6 – 40 voters: F > C > D > A > H > E > B > G
        ...Array.from({ length: 40 }, (_, i) =>
            ballot(
                `g6v${i}`,
                'optionF',
                'optionC',
                'optionD',
                'optionA',
                'optionH',
                'optionE',
                'optionB',
                'optionG',
            ),
        ),
        // Group 7 – 30 voters: G > A > F > H > C > D > E > B
        ...Array.from({ length: 30 }, (_, i) =>
            ballot(
                `g7v${i}`,
                'optionG',
                'optionA',
                'optionF',
                'optionH',
                'optionC',
                'optionD',
                'optionE',
                'optionB',
            ),
        ),
        // Group 8 – 25 voters: H > B > E > G > A > C > F > D
        ...Array.from({ length: 25 }, (_, i) =>
            ballot(
                `g8v${i}`,
                'optionH',
                'optionB',
                'optionE',
                'optionG',
                'optionA',
                'optionC',
                'optionF',
                'optionD',
            ),
        ),
        // Group 9 – 20 voters: A > C > E > G > B > D > F > H
        ...Array.from({ length: 20 }, (_, i) =>
            ballot(
                `g9v${i}`,
                'optionA',
                'optionC',
                'optionE',
                'optionG',
                'optionB',
                'optionD',
                'optionF',
                'optionH',
            ),
        ),
        // Group 10 – 18 voters: B > D > F > H > A > C > E > G
        ...Array.from({ length: 18 }, (_, i) =>
            ballot(
                `g10v${i}`,
                'optionB',
                'optionD',
                'optionF',
                'optionH',
                'optionA',
                'optionC',
                'optionE',
                'optionG',
            ),
        ),
        // Group 11 – 15 voters: C > E > G > A > B > D > F > H
        ...Array.from({ length: 15 }, (_, i) =>
            ballot(
                `g11v${i}`,
                'optionC',
                'optionE',
                'optionG',
                'optionA',
                'optionB',
                'optionD',
                'optionF',
                'optionH',
            ),
        ),
        // Group 12 – 12 voters: D > F > H > B > C > E > G > A
        ...Array.from({ length: 12 }, (_, i) =>
            ballot(
                `g12v${i}`,
                'optionD',
                'optionF',
                'optionH',
                'optionB',
                'optionC',
                'optionE',
                'optionG',
                'optionA',
            ),
        ),
    ];

    test('475 real ballots are created', () => {
        expect(ballots.length).toBe(475);
    });

    test('quota is 501 (floor(1000/2)+1)', () => {
        const { quota } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(quota).toBe(501);
    });

    test('8 rounds are recorded (7 eliminations + 1 final check)', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(rounds.length).toBe(8);
    });

    test('round 0: all 8 candidates spread across 25–100 votes', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[0]?.voteCounts;
        expect(vc?.get('optionA')).toBe(100); // Groups 1+9
        expect(vc?.get('optionB')).toBe(88); // Groups 2+10
        expect(vc?.get('optionC')).toBe(80); // Groups 3+11
        expect(vc?.get('optionD')).toBe(67); // Groups 4+12
        expect(vc?.get('optionE')).toBe(45); // Group 5
        expect(vc?.get('optionF')).toBe(40); // Group 6
        expect(vc?.get('optionG')).toBe(30); // Group 7
        expect(vc?.get('optionH')).toBe(25); // Group 8
    });

    test('round 2: H and G eliminated, A grows from G transfers', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[2]?.voteCounts;
        expect(vc?.get('optionA')).toBe(130); // +30 from Group7 (G>A>…)
        expect(vc?.get('optionB')).toBe(113); // +25 from Group8 (H>B>…)
        expect(vc?.get('optionC')).toBe(80);
        expect(vc?.get('optionD')).toBe(67);
        expect(vc?.get('optionE')).toBe(45);
        expect(vc?.get('optionF')).toBe(40);
        expect(vc?.get('optionG')).toBeUndefined();
        expect(vc?.get('optionH')).toBeUndefined();
    });

    test('round 4: 4 candidates remain, B surges past C from E transfers', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[4]?.voteCounts;
        expect(vc?.get('optionA')).toBe(130);
        expect(vc?.get('optionB')).toBe(158); // +45 from Group5 (E>H>B>…)
        expect(vc?.get('optionC')).toBe(120); // +40 from Group6 (F>C>…)
        expect(vc?.get('optionD')).toBe(67);
        expect(vc?.get('optionE')).toBeUndefined();
        expect(vc?.get('optionF')).toBeUndefined();
    });

    test('round 5: 3 candidates, C edges ahead of A and B after D transfers', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[5]?.voteCounts;
        expect(vc?.get('optionA')).toBe(130);
        expect(vc?.get('optionB')).toBe(170); // +12 from Group12 (D>F>H>B>…)
        expect(vc?.get('optionC')).toBe(175); // +55 from Group4 (D>G>C>…)
        expect(vc?.get('optionD')).toBeUndefined();
    });

    test('round 6: final two — B=250, C=225 after A eliminated and transfers split', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[6]?.voteCounts;
        expect(vc?.get('optionB')).toBe(250); // +80 from Group1 (A>D>G>B>…)
        expect(vc?.get('optionC')).toBe(225); // +20 from Group9 + 30 from Group7 (both →C)
        expect(vc?.get('optionA')).toBeUndefined();
    });

    test('round 7 (final): B consolidates all 475 real votes — still 26 short of quota', () => {
        const { rounds } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        const vc = rounds[7]?.voteCounts;
        expect(vc?.get('optionB')).toBe(475); // 250 + all 225 from C
        expect(vc?.get('optionC')).toBeUndefined();
    });

    test('no winner — 475 real votes can never reach quota 501', () => {
        const { winners } = runStvAlgorithm(
            ballots,
            candidates,
            1,
            blankVoteCount,
        );
        expect(winners.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Scenario 9: 8 candidates, 0 blank votes — winner emerges after 7 rounds
//             with lead changes and a mid-race tie between the top two
// ---------------------------------------------------------------------------

describe('Scenario 9: 8-candidate race, no blanks — dramatic 7-round win', () => {
    // 8 voter groups, 630 real ballots, 0 blank → quota = floor(630/2)+1 = 316.
    // Transfers are designed so A and B trade the lead across three phases,
    // reaching an exact tie at round 3 before A pulls away to win in round 6.
    //
    // Voter groups:
    //   160 voters: A > C > E > G > B > D > F > H  (Group 1)
    //   120 voters: B > D > F > H > A > C > E > G  (Group 2)
    //    95 voters: C > E > G > A > B > D > F > H  (Group 3)
    //    75 voters: D > F > H > B > C > E > G > A  (Group 4)
    //    60 voters: E > G > A > C > B > D > F > H  (Group 5)
    //    50 voters: F > H > B > D > A > C > E > G  (Group 6)
    //    40 voters: G > A > C > E > B > D > F > H  (Group 7)
    //    30 voters: H > B > D > F > A > C > E > G  (Group 8)
    //
    // Cascades (each group skips already-eliminated candidates):
    //   R0: A=160 B=120 C=95 D=75 E=60 F=50 G=40 H=30 → H(30) eliminated → H→B
    //   R1: A=160 B=150 C=95 D=75 E=60 F=50 G=40       → G(40) eliminated → G→A
    //   R2: A=200 B=150 C=95 D=75 E=60 F=50             → F(50) eliminated → F→B (skip elim'd H)
    //   R3: A=200 B=200 C=95 D=75 E=60                  → E(60) eliminated → E→A (skip elim'd G)
    //   R4: A=260 B=200 C=95 D=75                       → D(75) eliminated → D→B (skip F, H)
    //   R5: A=260 B=275 C=95                            → C(95) eliminated → C→A (skip E, G)
    //   R6: A=355 B=275                                 → A=355 ≥ 316 → A WINS

    const candidates = [
        'optionA',
        'optionB',
        'optionC',
        'optionD',
        'optionE',
        'optionF',
        'optionG',
        'optionH',
    ];

    const ballots: StvBallot[] = [
        // Group 1 – 160: A > C > E > G > B > D > F > H
        ...Array.from({ length: 160 }, (_, i) =>
            ballot(
                `g1v${i}`,
                'optionA',
                'optionC',
                'optionE',
                'optionG',
                'optionB',
                'optionD',
                'optionF',
                'optionH',
            ),
        ),
        // Group 2 – 120: B > D > F > H > A > C > E > G
        ...Array.from({ length: 120 }, (_, i) =>
            ballot(
                `g2v${i}`,
                'optionB',
                'optionD',
                'optionF',
                'optionH',
                'optionA',
                'optionC',
                'optionE',
                'optionG',
            ),
        ),
        // Group 3 – 95: C > E > G > A > B > D > F > H
        ...Array.from({ length: 95 }, (_, i) =>
            ballot(
                `g3v${i}`,
                'optionC',
                'optionE',
                'optionG',
                'optionA',
                'optionB',
                'optionD',
                'optionF',
                'optionH',
            ),
        ),
        // Group 4 – 75: D > F > H > B > C > E > G > A
        ...Array.from({ length: 75 }, (_, i) =>
            ballot(
                `g4v${i}`,
                'optionD',
                'optionF',
                'optionH',
                'optionB',
                'optionC',
                'optionE',
                'optionG',
                'optionA',
            ),
        ),
        // Group 5 – 60: E > G > A > C > B > D > F > H
        ...Array.from({ length: 60 }, (_, i) =>
            ballot(
                `g5v${i}`,
                'optionE',
                'optionG',
                'optionA',
                'optionC',
                'optionB',
                'optionD',
                'optionF',
                'optionH',
            ),
        ),
        // Group 6 – 50: F > H > B > D > A > C > E > G
        ...Array.from({ length: 50 }, (_, i) =>
            ballot(
                `g6v${i}`,
                'optionF',
                'optionH',
                'optionB',
                'optionD',
                'optionA',
                'optionC',
                'optionE',
                'optionG',
            ),
        ),
        // Group 7 – 40: G > A > C > E > B > D > F > H
        ...Array.from({ length: 40 }, (_, i) =>
            ballot(
                `g7v${i}`,
                'optionG',
                'optionA',
                'optionC',
                'optionE',
                'optionB',
                'optionD',
                'optionF',
                'optionH',
            ),
        ),
        // Group 8 – 30: H > B > D > F > A > C > E > G
        ...Array.from({ length: 30 }, (_, i) =>
            ballot(
                `g8v${i}`,
                'optionH',
                'optionB',
                'optionD',
                'optionF',
                'optionA',
                'optionC',
                'optionE',
                'optionG',
            ),
        ),
    ];

    test('630 real ballots, 0 blank', () => {
        expect(ballots.length).toBe(630);
    });

    test('quota is 316 (floor(630/2)+1)', () => {
        const { quota } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(quota).toBe(316);
    });

    test('7 rounds are recorded (6 eliminations + 1 winning round)', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(rounds.length).toBe(7);
    });

    test('round 0: 8 candidates with clearly distinct vote counts', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[0]?.voteCounts;
        expect(vc?.get('optionA')).toBe(160);
        expect(vc?.get('optionB')).toBe(120);
        expect(vc?.get('optionC')).toBe(95);
        expect(vc?.get('optionD')).toBe(75);
        expect(vc?.get('optionE')).toBe(60);
        expect(vc?.get('optionF')).toBe(50);
        expect(vc?.get('optionG')).toBe(40);
        expect(vc?.get('optionH')).toBe(30);
    });

    test('round 3: A and B reach an exact tie at 200 votes each', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[3]?.voteCounts;
        expect(vc?.get('optionA')).toBe(200);
        expect(vc?.get('optionB')).toBe(200);
        expect(vc?.get('optionC')).toBe(95);
        expect(vc?.get('optionD')).toBe(75);
        expect(vc?.get('optionE')).toBe(60);
    });

    test('round 5: B briefly overtakes A (275 vs 260) after D transfers', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[5]?.voteCounts;
        expect(vc?.get('optionA')).toBe(260);
        expect(vc?.get('optionB')).toBe(275);
        expect(vc?.get('optionC')).toBe(95);
        expect(vc?.get('optionD')).toBeUndefined();
    });

    test('round 6: A surges to 355 on C transfers, crossing quota 316', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[6]?.voteCounts;
        expect(vc?.get('optionA')).toBe(355);
        expect(vc?.get('optionB')).toBe(275);
        expect(vc?.get('optionC')).toBeUndefined();
    });

    test('optionA wins with 355 votes (≥ quota 316)', () => {
        const { winners } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(winners.has('optionA')).toBe(true);
        expect(winners.size).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Scenario 10: Dark-horse winner — optionD starts 4th, never leads until
//              the final round, wins entirely through transfer accumulation
// ---------------------------------------------------------------------------

describe('Scenario 10: Dark-horse winner — 4th place on first-choice votes wins via transfers', () => {
    // 8 voter groups, 660 real ballots, 0 blank → quota = floor(660/2)+1 = 331.
    //
    // The twist: A and B voters are "tribal" — they rank D dead last.
    // Every eliminated minor candidate (H, G, F, E, C) ranks D second.
    // D is the consensus candidate nobody feared, so it absorbs all
    // transfer votes while A and B stay frozen at their opening numbers.
    //
    // Voter groups:
    //   160 voters: A > B > C > E > F > G > H > D  (Group 1 — tribal A fans, D last)
    //   130 voters: B > A > C > E > F > G > H > D  (Group 2 — tribal B fans, D last)
    //   100 voters: C > D > A > B > E > F > G > H  (Group 3 — C fans, D second)
    //    90 voters: D > C > A > B > E > F > G > H  (Group 4 — D core voters)
    //    60 voters: E > D > C > A > B > F > G > H  (Group 5 — E fans, D second)
    //    50 voters: F > D > C > A > B > E > G > H  (Group 6 — F fans, D second)
    //    40 voters: G > D > C > A > B > E > F > H  (Group 7 — G fans, D second)
    //    30 voters: H > D > C > A > B > E > F > G  (Group 8 — H fans, D second)
    //
    // A and B never gain a single transfer vote — they're frozen at 160 and 130.
    // D absorbs every eliminated candidate's votes and climbs from 4th to 1st:
    //
    //   R0: A=160 B=130 C=100 D=90  E=60 F=50 G=40 H=30  → H(30)→D
    //   R1: A=160 B=130 C=100 D=120 E=60 F=50 G=40        → G(40)→D
    //   R2: A=160 B=130 C=100 D=160 E=60 F=50             → D ties A; F(50)→D
    //   R3: A=160 B=130 C=100 D=210 E=60                  → D leads; E(60)→D
    //   R4: A=160 B=130 C=100 D=270                       → C(100)→D
    //   R5: A=160 B=130 D=370                             → D=370 ≥ 331 → D WINS

    const candidates = [
        'optionA',
        'optionB',
        'optionC',
        'optionD',
        'optionE',
        'optionF',
        'optionG',
        'optionH',
    ];

    const ballots: StvBallot[] = [
        // Group 1 – 160: A > B > C > E > F > G > H > D
        ...Array.from({ length: 160 }, (_, i) =>
            ballot(
                `g1v${i}`,
                'optionA',
                'optionB',
                'optionC',
                'optionE',
                'optionF',
                'optionG',
                'optionH',
                'optionD',
            ),
        ),
        // Group 2 – 130: B > A > C > E > F > G > H > D
        ...Array.from({ length: 130 }, (_, i) =>
            ballot(
                `g2v${i}`,
                'optionB',
                'optionA',
                'optionC',
                'optionE',
                'optionF',
                'optionG',
                'optionH',
                'optionD',
            ),
        ),
        // Group 3 – 100: C > D > A > B > E > F > G > H
        ...Array.from({ length: 100 }, (_, i) =>
            ballot(
                `g3v${i}`,
                'optionC',
                'optionD',
                'optionA',
                'optionB',
                'optionE',
                'optionF',
                'optionG',
                'optionH',
            ),
        ),
        // Group 4 – 90: D > C > A > B > E > F > G > H
        ...Array.from({ length: 90 }, (_, i) =>
            ballot(
                `g4v${i}`,
                'optionD',
                'optionC',
                'optionA',
                'optionB',
                'optionE',
                'optionF',
                'optionG',
                'optionH',
            ),
        ),
        // Group 5 – 60: E > D > C > A > B > F > G > H
        ...Array.from({ length: 60 }, (_, i) =>
            ballot(
                `g5v${i}`,
                'optionE',
                'optionD',
                'optionC',
                'optionA',
                'optionB',
                'optionF',
                'optionG',
                'optionH',
            ),
        ),
        // Group 6 – 50: F > D > C > A > B > E > G > H
        ...Array.from({ length: 50 }, (_, i) =>
            ballot(
                `g6v${i}`,
                'optionF',
                'optionD',
                'optionC',
                'optionA',
                'optionB',
                'optionE',
                'optionG',
                'optionH',
            ),
        ),
        // Group 7 – 40: G > D > C > A > B > E > F > H
        ...Array.from({ length: 40 }, (_, i) =>
            ballot(
                `g7v${i}`,
                'optionG',
                'optionD',
                'optionC',
                'optionA',
                'optionB',
                'optionE',
                'optionF',
                'optionH',
            ),
        ),
        // Group 8 – 30: H > D > C > A > B > E > F > G
        ...Array.from({ length: 30 }, (_, i) =>
            ballot(
                `g8v${i}`,
                'optionH',
                'optionD',
                'optionC',
                'optionA',
                'optionB',
                'optionE',
                'optionF',
                'optionG',
            ),
        ),
    ];

    test('660 real ballots, 0 blank', () => {
        expect(ballots.length).toBe(660);
    });

    test('quota is 331 (floor(660/2)+1)', () => {
        const { quota } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(quota).toBe(331);
    });

    test('6 rounds are recorded (5 eliminations + 1 winning round)', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(rounds.length).toBe(6);
    });

    test('round 0: A leads with 160, D sits in 4th with only 90', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[0]?.voteCounts;
        expect(vc?.get('optionA')).toBe(160);
        expect(vc?.get('optionB')).toBe(130);
        expect(vc?.get('optionC')).toBe(100);
        expect(vc?.get('optionD')).toBe(90);
        expect(vc?.get('optionE')).toBe(60);
        expect(vc?.get('optionF')).toBe(50);
        expect(vc?.get('optionG')).toBe(40);
        expect(vc?.get('optionH')).toBe(30);
    });

    test('round 2: D climbs to tie A at 160 — still under the radar', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[2]?.voteCounts;
        expect(vc?.get('optionA')).toBe(160);
        expect(vc?.get('optionD')).toBe(160); // D has caught A exactly
        expect(vc?.get('optionB')).toBe(130);
        expect(vc?.get('optionC')).toBe(100);
        expect(vc?.get('optionE')).toBe(60);
        expect(vc?.get('optionF')).toBe(50);
    });

    test('round 3: D takes the lead at 210, but A and B are still frozen', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[3]?.voteCounts;
        expect(vc?.get('optionD')).toBe(210);
        expect(vc?.get('optionA')).toBe(160); // frozen — zero transfers received
        expect(vc?.get('optionB')).toBe(130); // frozen — zero transfers received
        expect(vc?.get('optionC')).toBe(100);
        expect(vc?.get('optionE')).toBe(60);
    });

    test('round 5: D wins with 370 votes while A and B never moved from 160 and 130', () => {
        const { rounds } = runStvAlgorithm(ballots, candidates, 1, 0);
        const vc = rounds[5]?.voteCounts;
        expect(vc?.get('optionD')).toBe(370); // 90 + 30 + 40 + 50 + 60 + 100
        expect(vc?.get('optionA')).toBe(160); // unchanged from round 0
        expect(vc?.get('optionB')).toBe(130); // unchanged from round 0
    });

    test('optionD wins despite starting 4th — the dark horse', () => {
        const { winners } = runStvAlgorithm(ballots, candidates, 1, 0);
        expect(winners.has('optionD')).toBe(true);
        expect(winners.has('optionA')).toBe(false);
        expect(winners.size).toBe(1);
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
