import { eq, and, asc } from 'drizzle-orm';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { votation, alternative, stvRoundResult } from '#/db/schema.ts';
import { db } from '#/db/index.ts';
import { requireParticipant } from './permissions.server.ts';

// ---------------------------------------------------------------------------
// Result queries
// ---------------------------------------------------------------------------

export const getVotationResults = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: eq(votation.id, data.votationId),
            with: {
                alternatives: {
                    with: { votes: true },
                    orderBy: [asc(alternative.index)],
                },
                result: {
                    with: {
                        stvRoundResults: {
                            with: {
                                alternativeVoteCounts: true,
                            },
                            orderBy: [asc(stvRoundResult.index)],
                        },
                    },
                },
            },
        });

        if (!v) throw new Error('Voteringen finnes ikke');

        const { participant: p } = await requireParticipant(v.meetingId);

        // Check visibility
        if (
            v.hiddenVotes &&
            p.role !== 'ADMIN' &&
            p.role !== 'COUNTER' &&
            v.status !== 'PUBLISHED_RESULT'
        ) {
            throw new Error('Resultatene er skjulte');
        }

        if (v.status !== 'CHECKING_RESULT' && v.status !== 'PUBLISHED_RESULT') {
            throw new Error('Resultatene er ikke klare ennå');
        }

        return {
            votation: v,
            result: v.result,
            alternatives: v.alternatives.map((alt) => ({
                id: alt.id,
                text: alt.text,
                isWinner: alt.isWinner,
                voteCount: alt.votes.length,
            })),
        };
    });

export const getWinnerOfVotation = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: eq(votation.id, data.votationId),
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireParticipant(v.meetingId);

        const winners = await db.query.alternative.findMany({
            where: and(
                eq(alternative.votationId, data.votationId),
                eq(alternative.isWinner, true),
            ),
        });

        return winners;
    });
