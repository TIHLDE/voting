import { createServerFn } from '@tanstack/react-start';
import { eq, and, asc, desc } from 'drizzle-orm';
import { z } from 'zod';
import { votation, alternative } from '#/db/schema.ts';
import { db } from '#/db/index.ts';
import { requireAdmin, requireParticipant } from './permissions.server.ts';

export const getVotationsForMeeting = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireParticipant(data.meetingId);

        return db.query.votation.findMany({
            where: eq(votation.meetingId, data.meetingId),
            with: {
                alternatives: {
                    orderBy: [asc(alternative.index)],
                },
            },
            orderBy: [asc(votation.index)],
        });
    });

export const getVotationById = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: eq(votation.id, data.votationId),
            with: {
                alternatives: {
                    orderBy: [asc(alternative.index)],
                },
                result: true,
            },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireParticipant(v.meetingId);
        return v;
    });

const createAlternativeSchema = z.object({
    text: z.string().min(1).max(120),
    index: z.number(),
});

const createVotationSchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    type: z.enum(['SIMPLE', 'QUALIFIED', 'STV']),
    blankVotes: z.boolean().default(false),
    hiddenVotes: z.boolean().default(false),
    numberOfWinners: z.number().default(1),
    majorityThreshold: z.number().default(50),
    index: z.number(),
    alternatives: z.array(createAlternativeSchema).optional(),
});

export const createVotations = createServerFn({ method: 'POST' })
    .inputValidator(
        z.object({
            meetingId: z.string(),
            votations: z.array(createVotationSchema),
        }),
    )
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        const created = [];

        for (const v of data.votations) {
            const { alternatives: alts, ...votationData } = v;
            const [newVotation] = await db
                .insert(votation)
                .values({
                    ...votationData,
                    meetingId: data.meetingId,
                })
                .returning();

            if (alts && alts.length > 0) {
                await db.insert(alternative).values(
                    alts.map((a) => ({
                        text: a.text,
                        index: a.index,
                        votationId: newVotation.id,
                    })),
                );
            }

            created.push(newVotation);
        }

        return created;
    });

const updateVotationSchema = z.object({
    id: z.string(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    type: z.enum(['SIMPLE', 'QUALIFIED', 'STV']),
    blankVotes: z.boolean(),
    hiddenVotes: z.boolean(),
    numberOfWinners: z.number(),
    majorityThreshold: z.number(),
    index: z.number(),
    alternatives: z
        .array(
            z.object({
                id: z.string().optional(),
                text: z.string().min(1).max(120),
                index: z.number(),
            }),
        )
        .optional(),
});

export const updateVotations = createServerFn({ method: 'POST' })
    .inputValidator(
        z.object({
            meetingId: z.string(),
            votations: z.array(updateVotationSchema),
        }),
    )
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        const updated = [];

        for (const v of data.votations) {
            // Verify votation is UPCOMING
            const existing = await db.query.votation.findFirst({
                where: eq(votation.id, v.id),
            });
            if (!existing || existing.status !== 'UPCOMING') {
                throw new Error('Kan kun redigere kommende voteringer');
            }

            const { id, alternatives: alts, ...updateData } = v;
            const [updatedVotation] = await db
                .update(votation)
                .set(updateData)
                .where(eq(votation.id, id))
                .returning();

            if (alts) {
                // Delete existing alternatives and recreate
                await db
                    .delete(alternative)
                    .where(eq(alternative.votationId, id));

                if (alts.length > 0) {
                    await db.insert(alternative).values(
                        alts.map((a) => ({
                            text: a.text,
                            index: a.index,
                            votationId: id,
                        })),
                    );
                }
            }

            updated.push(updatedVotation);
        }

        return updated;
    });

export const updateVotationIndexes = createServerFn({ method: 'POST' })
    .inputValidator(
        z.object({
            meetingId: z.string(),
            votations: z.array(z.object({ id: z.string(), index: z.number() })),
        }),
    )
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        for (const v of data.votations) {
            await db
                .update(votation)
                .set({ index: v.index })
                .where(eq(votation.id, v.id));
        }

        return { success: true };
    });

export const deleteVotation = createServerFn({ method: 'POST' })
    .inputValidator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: eq(votation.id, data.votationId),
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireAdmin(v.meetingId);
        await db.delete(votation).where(eq(votation.id, data.votationId));

        return { success: true };
    });

export const deleteAlternatives = createServerFn({ method: 'POST' })
    .inputValidator(z.object({ ids: z.array(z.string()) }))
    .handler(async ({ data }) => {
        for (const id of data.ids) {
            const alt = await db.query.alternative.findFirst({
                where: eq(alternative.id, id),
                with: { votation: true },
            });
            if (alt) {
                await requireAdmin(alt.votation.meetingId);
                await db.delete(alternative).where(eq(alternative.id, id));
            }
        }

        return { success: true };
    });

export const getOpenVotation = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireParticipant(data.meetingId);

        const open = await db.query.votation.findFirst({
            where: and(
                eq(votation.meetingId, data.meetingId),
                eq(votation.status, 'OPEN'),
            ),
        });

        return open?.id ?? null;
    });

export const getActiveVotationId = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireParticipant(data.meetingId);

        for (const status of [
            'OPEN',
            'CHECKING_RESULT',
            'PUBLISHED_RESULT',
        ] as const) {
            const v = await db.query.votation.findFirst({
                where: and(
                    eq(votation.meetingId, data.meetingId),
                    eq(votation.status, status),
                ),
                orderBy: [desc(votation.index)],
            });
            if (v) return v.id;
        }

        return null;
    });
