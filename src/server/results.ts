import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '#/db/index';
import { requireParticipant } from './permissions.server';

// ---------------------------------------------------------------------------
// Result queries
// ---------------------------------------------------------------------------

export const getVotationResults = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
            with: {
                alternatives: {
                    with: { votes: true },
                    orderBy: { index: 'asc' },
                },
                result: {
                    with: {
                        stvRoundResults: {
                            with: {
                                alternativeVoteCounts: true,
                            },
                            orderBy: { index: 'asc' },
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
                voteCount:
                    v.type === 'STV'
                        ? alt.votes.filter((vote) => vote.ranking === 1).length
                        : alt.votes.length,
            })),
        };
    });

export const getWinnerOfVotation = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireParticipant(v.meetingId);

        const winners = await db.query.alternative.findMany({
            where: { votationId: data.votationId, isWinner: true },
        });

        return winners;
    });
