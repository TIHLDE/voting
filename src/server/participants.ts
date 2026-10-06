import { createServerFn } from '@tanstack/react-start';
import { and, eq, exists, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { participant, invite, user, meeting } from '#/db/schema';
import { db } from '#/db/index';
import { requireAuth } from './auth-session.server';
import {
    requireAdmin,
    requireAdminOrCounter,
    requireOwner,
    requireParticipant,
} from './permissions.server';
import { publish } from './sse/emitter';
import { liveEvents } from '#/lib/live-events';
import { getVoteCountData } from './voting.server';

/**
 * Tells admins and counters to refetch the participant list, tells each
 * affected user that their own participation changed, and refreshes the
 * eligible voter count of an open votation.
 */
async function publishParticipantChanges(
    meetingId: string,
    affected: { userIds: string[]; status: 'updated' | 'removed' },
) {
    publish(liveEvents.meetingParticipantsUpdated(meetingId), {});
    for (const userId of affected.userIds) {
        publish(
            liveEvents.participantStatus(userId, meetingId),
            affected.status === 'removed'
                ? { removed: true }
                : { updated: true },
        );
    }

    const open = await db.query.votation.findFirst({
        where: { meetingId, status: 'OPEN' },
    });
    if (open) {
        publish(
            liveEvents.votationVotes(open.id),
            await getVoteCountData(open.id, meetingId),
        );
    }
}

export const getParticipants = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        const [m] = await db
            .select()
            .from(meeting)
            .where(eq(meeting.id, data.meetingId));

        const participants = await db.query.participant.findMany({
            where: { meetingId: data.meetingId, isApproved: true },
            with: { user: true },
        });

        const invites = await db.query.invite.findMany({
            where: { meetingId: data.meetingId },
        });

        return { participants, invites, ownerId: m?.ownerId };
    });

export const getPendingParticipants = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        return db.query.participant.findMany({
            where: { meetingId: data.meetingId, isApproved: false },
            with: { user: true },
        });
    });

export const getMyParticipant = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        const result = await requireParticipant(data.meetingId);
        return result.participant;
    });

export const getMyRegistrationStatus = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        const session = await requireAuth();

        const [p] = await db
            .select()
            .from(participant)
            .where(
                and(
                    eq(participant.userId, session.user.id),
                    eq(participant.meetingId, data.meetingId),
                ),
            );

        if (!p) return { status: 'not_registered' as const };
        if (!p.isApproved) return { status: 'pending' as const };
        return { status: 'approved' as const };
    });

const addParticipantSchema = z.object({
    meetingId: z.string(),
    email: z.email(),
    role: z.enum(['ADMIN', 'COUNTER', 'PARTICIPANT']),
    isVotingEligible: z.boolean().default(true),
});

export const addParticipant = createServerFn({ method: 'POST' })
    .validator(addParticipantSchema)
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        const [existingUser] = await db
            .select()
            .from(user)
            .where(eq(user.email, data.email));

        // Users without an account are invited, and become participants
        // when they sign up.
        if (!existingUser) {
            const [existingInvite] = await db
                .select()
                .from(invite)
                .where(
                    and(
                        eq(invite.meetingId, data.meetingId),
                        eq(invite.email, data.email),
                    ),
                );
            if (existingInvite) {
                throw new Error('Denne e-posten er allerede invitert');
            }

            await db.insert(invite).values({
                email: data.email,
                role: data.role,
                isVotingEligible: data.isVotingEligible,
                meetingId: data.meetingId,
            });
            publish(liveEvents.meetingParticipantsUpdated(data.meetingId), {});
            return;
        }

        const [existingParticipant] = await db
            .select()
            .from(participant)
            .where(
                and(
                    eq(participant.meetingId, data.meetingId),
                    eq(participant.userId, existingUser.id),
                ),
            );
        if (existingParticipant) {
            throw new Error('Brukeren er allerede deltaker i møtet');
        }

        await db.insert(participant).values({
            role: data.role,
            isVotingEligible: data.isVotingEligible,
            isApproved: true,
            userId: existingUser.id,
            meetingId: data.meetingId,
        });

        await publishParticipantChanges(data.meetingId, {
            userIds: [existingUser.id],
            status: 'updated',
        });
    });

const updateParticipantSchema = z.object({
    meetingId: z.string(),
    participantId: z.string(),
    role: z.enum(['ADMIN', 'COUNTER', 'PARTICIPANT']).optional(),
    isVotingEligible: z.boolean().optional(),
});

export const updateParticipant = createServerFn({ method: 'POST' })
    .validator(updateParticipantSchema)
    .handler(async ({ data }) => {
        const { participant: caller } = await requireAdminOrCounter(
            data.meetingId,
        );

        // Counters can only change voting eligibility, not roles
        if (caller.role === 'COUNTER' && data.role !== undefined) {
            throw new Error('Tellere kan ikke endre roller');
        }

        // Check owner protection
        const [[p], [m]] = await Promise.all([
            db
                .select()
                .from(participant)
                .where(eq(participant.id, data.participantId)),
            db.select().from(meeting).where(eq(meeting.id, data.meetingId)),
        ]);

        if (!p) throw new Error('Deltakeren finnes ikke');

        if (m && p.userId === m.ownerId && data.role !== undefined) {
            throw new Error('Kan ikke endre eierens rolle');
        }

        const updates: Record<string, unknown> = {};
        if (data.role !== undefined) updates.role = data.role;
        if (data.isVotingEligible !== undefined)
            updates.isVotingEligible = data.isVotingEligible;

        const [updated] = await db
            .update(participant)
            .set(updates)
            .where(eq(participant.id, data.participantId))
            .returning();

        await publishParticipantChanges(data.meetingId, {
            userIds: [p.userId],
            status: 'updated',
        });

        return updated;
    });

const bulkUpdateVotingEligibilitySchema = z.object({
    meetingId: z.string(),
    participantIds: z.array(z.string()),
    isVotingEligible: z.boolean(),
});

export const bulkUpdateVotingEligibility = createServerFn({ method: 'POST' })
    .validator(bulkUpdateVotingEligibilitySchema)
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        if (data.participantIds.length > 0) {
            const updated = await db
                .update(participant)
                .set({ isVotingEligible: data.isVotingEligible })
                .where(inArray(participant.id, data.participantIds))
                .returning({ userId: participant.userId });

            await publishParticipantChanges(data.meetingId, {
                userIds: updated.map((item) => item.userId),
                status: 'updated',
            });
        }

        return { updatedCount: data.participantIds.length };
    });

export const deleteParticipants = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            meetingId: z.string(),
            participantIds: z.array(z.string()),
            inviteEmails: z.array(z.string()).optional(),
        }),
    )
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        const [m] = await db
            .select()
            .from(meeting)
            .where(eq(meeting.id, data.meetingId));

        const participantsToDelete =
            data.participantIds.length > 0
                ? await db
                      .select()
                      .from(participant)
                      .where(inArray(participant.id, data.participantIds))
                : [];

        if (
            m &&
            participantsToDelete.some((item) => item.userId === m.ownerId)
        ) {
            throw new Error('Kan ikke fjerne eieren av møtet');
        }

        await Promise.all([
            data.participantIds.length > 0
                ? db
                      .delete(participant)
                      .where(inArray(participant.id, data.participantIds))
                : Promise.resolve(),
            data.inviteEmails?.length
                ? db
                      .delete(invite)
                      .where(
                          and(
                              inArray(invite.email, data.inviteEmails),
                              eq(invite.meetingId, data.meetingId),
                          ),
                      )
                : Promise.resolve(),
        ]);

        await publishParticipantChanges(data.meetingId, {
            userIds: participantsToDelete.map((item) => item.userId),
            status: 'removed',
        });

        return { success: true };
    });

export const transferOwnership = createServerFn({ method: 'POST' })
    .validator(z.object({ meetingId: z.string(), participantId: z.string() }))
    .handler(async ({ data }) => {
        const { session } = await requireOwner(data.meetingId);

        const [target] = await db
            .select()
            .from(participant)
            .where(
                and(
                    eq(participant.id, data.participantId),
                    eq(participant.meetingId, data.meetingId),
                ),
            );

        if (!target || !target.isApproved) {
            throw new Error('Deltakeren finnes ikke');
        }
        if (target.userId === session.user.id) {
            throw new Error('Du er allerede eier av møtet');
        }
        if (target.role !== 'ADMIN') {
            throw new Error('Kun administratorer kan bli eier av møtet');
        }

        const [transferred] = await db
            .update(meeting)
            .set({ ownerId: target.userId })
            .where(
                and(
                    eq(meeting.id, data.meetingId),
                    eq(meeting.ownerId, session.user.id),
                    exists(
                        db
                            .select()
                            .from(participant)
                            .where(
                                and(
                                    eq(participant.id, target.id),
                                    eq(participant.role, 'ADMIN'),
                                    eq(participant.isApproved, true),
                                ),
                            ),
                    ),
                ),
            )
            .returning({ id: meeting.id });
        if (!transferred) {
            throw new Error(
                'Eierskapet kunne ikke overføres. Last inn siden og prøv igjen.',
            );
        }

        publish(liveEvents.meetingUpdated(data.meetingId), {});
        publish(liveEvents.meetingParticipantsUpdated(data.meetingId), {});

        return { success: true };
    });

export const registerAsParticipant = createServerFn({ method: 'POST' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        const session = await requireAuth();

        const [m] = await db
            .select()
            .from(meeting)
            .where(eq(meeting.id, data.meetingId));

        if (!m) throw new Error('Møtet finnes ikke');
        if (!m.allowSelfRegistration)
            throw new Error('Selvregistrering er ikke aktivert');

        // Check if already a participant
        const [existing] = await db
            .select()
            .from(participant)
            .where(
                and(
                    eq(participant.userId, session.user.id),
                    eq(participant.meetingId, data.meetingId),
                ),
            );

        if (existing) return existing;

        const [newParticipant] = await db
            .insert(participant)
            .values({
                role: 'PARTICIPANT',
                isVotingEligible: true,
                isApproved: false,
                userId: session.user.id,
                meetingId: data.meetingId,
            })
            .returning();

        publish(liveEvents.meetingParticipantPending(data.meetingId), {
            participantId: newParticipant.id,
            userName: session.user.name,
        });

        return newParticipant;
    });

export const approveParticipant = createServerFn({ method: 'POST' })
    .validator(z.object({ meetingId: z.string(), participantId: z.string() }))
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        const [updated] = await db
            .update(participant)
            .set({ isApproved: true })
            .where(eq(participant.id, data.participantId))
            .returning();

        if (!updated) throw new Error('Deltakeren finnes ikke');

        publish(liveEvents.participantStatus(updated.userId, data.meetingId), {
            approved: true,
        });
        await publishParticipantChanges(data.meetingId, {
            userIds: [],
            status: 'updated',
        });

        return updated;
    });

export const denyParticipant = createServerFn({ method: 'POST' })
    .validator(z.object({ meetingId: z.string(), participantId: z.string() }))
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        const [p] = await db
            .select()
            .from(participant)
            .where(eq(participant.id, data.participantId));
        if (!p) throw new Error('Deltakeren finnes ikke');

        await db
            .delete(participant)
            .where(eq(participant.id, data.participantId));

        publish(liveEvents.participantStatus(p.userId, data.meetingId), {
            denied: true,
        });
        publish(liveEvents.meetingParticipantsUpdated(data.meetingId), {});

        return { success: true };
    });
