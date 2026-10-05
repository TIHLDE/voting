import { createServerFn } from '@tanstack/react-start';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { votation, alternative } from '#/db/schema';
import { db } from '#/db/index';
import { requireAdmin, requireParticipant } from './permissions.server';
import { publish } from './sse/emitter';
import { liveEvents } from '#/lib/live-events';

export const getVotationsForMeeting = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireParticipant(data.meetingId);

        return db.query.votation.findMany({
            where: { meetingId: data.meetingId },
            with: {
                alternatives: {
                    orderBy: { index: 'asc' },
                },
            },
            orderBy: { index: 'asc' },
        });
    });

export const getVotationById = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
            with: {
                alternatives: {
                    orderBy: { index: 'asc' },
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
    blankVotes: z.boolean().default(true),
    hiddenVotes: z.boolean().default(true),
    numberOfWinners: z.number().default(1),
    majorityThreshold: z.number().default(50),
    index: z.number(),
    alternatives: z.array(createAlternativeSchema).optional(),
});

export const createVotations = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            meetingId: z.string(),
            votations: z.array(createVotationSchema),
        }),
    )
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        const created = await Promise.all(
            data.votations.map(async (item) => {
                const { alternatives: alts, ...votationData } = item;
                const [newVotation] = await db
                    .insert(votation)
                    .values({
                        ...votationData,
                        meetingId: data.meetingId,
                    })
                    .returning();

                if (alts && alts.length > 0) {
                    await db.insert(alternative).values(
                        alts.map((alternativeItem) => ({
                            text: alternativeItem.text,
                            index: alternativeItem.index,
                            votationId: newVotation.id,
                        })),
                    );
                }

                return newVotation;
            }),
        );

        publish(liveEvents.meetingVotationsUpdated(data.meetingId), {});
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
    .validator(
        z.object({
            meetingId: z.string(),
            votations: z.array(updateVotationSchema),
        }),
    )
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        const updated = await Promise.all(
            data.votations.map(async (item) => {
                // Verify votation is UPCOMING
                const existing = await db.query.votation.findFirst({
                    where: { id: item.id },
                });
                if (!existing || existing.status !== 'UPCOMING') {
                    throw new Error('Kan kun redigere kommende voteringer');
                }

                const { id, alternatives: alts, ...updateData } = item;
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
                            alts.map((alternativeItem) => ({
                                text: alternativeItem.text,
                                index: alternativeItem.index,
                                votationId: id,
                            })),
                        );
                    }
                }

                return updatedVotation;
            }),
        );

        publish(liveEvents.meetingVotationsUpdated(data.meetingId), {});
        return updated;
    });

export const updateVotationIndexes = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            meetingId: z.string(),
            votations: z.array(z.object({ id: z.string(), index: z.number() })),
        }),
    )
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        await Promise.all(
            data.votations.map((item) =>
                db
                    .update(votation)
                    .set({ index: item.index })
                    .where(eq(votation.id, item.id)),
            ),
        );

        publish(liveEvents.meetingVotationsUpdated(data.meetingId), {});
        return { success: true };
    });

export const deleteVotation = createServerFn({ method: 'POST' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireAdmin(v.meetingId);
        await db.delete(votation).where(eq(votation.id, data.votationId));

        publish(liveEvents.meetingVotationsUpdated(v.meetingId), {});
        return { success: true };
    });

export const deleteAlternatives = createServerFn({ method: 'POST' })
    .validator(z.object({ ids: z.array(z.string()) }))
    .handler(async ({ data }) => {
        if (data.ids.length === 0) return { success: true };

        const alternatives = await db.query.alternative.findMany({
            where: { id: { in: data.ids } },
            with: { votation: true },
        });
        const meetingIds = Array.from(
            new Set(alternatives.map((item) => item.votation.meetingId)),
        );
        await Promise.all(
            meetingIds.map((meetingId) => requireAdmin(meetingId)),
        );
        await db.delete(alternative).where(inArray(alternative.id, data.ids));

        for (const meetingId of meetingIds) {
            publish(liveEvents.meetingVotationsUpdated(meetingId), {});
        }
        return { success: true };
    });

export const getOpenVotation = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireParticipant(data.meetingId);

        const open = await db.query.votation.findFirst({
            where: { meetingId: data.meetingId, status: 'OPEN' },
        });

        return open?.id ?? null;
    });

export const getActiveVotationId = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireParticipant(data.meetingId);

        // Votations start in index order, so the last started one (open,
        // being checked, published or cancelled) has the highest index.
        const v = await db.query.votation.findFirst({
            where: { meetingId: data.meetingId, status: { ne: 'UPCOMING' } },
            orderBy: { index: 'desc' },
        });

        return v?.id ?? null;
    });
