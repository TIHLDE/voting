import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { participant, invite, user, meeting } from '#/db/schema';
import { db } from '#/db/index';
import { requireAuth } from './auth-session.server';
import {
    requireAdmin,
    requireAdminOrCounter,
    requireParticipant,
} from './permissions.server';
import { publish } from './sse/emitter';
import { liveEvents } from '#/lib/live-events';

export const getParticipants = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ meetingId: z.string() }))
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
    .inputValidator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        return db.query.participant.findMany({
            where: { meetingId: data.meetingId, isApproved: false },
            with: { user: true },
        });
    });

export const getMyParticipant = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        const result = await requireParticipant(data.meetingId);
        return result.participant;
    });

export const getMyRegistrationStatus = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ meetingId: z.string() }))
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

const addParticipantsSchema = z.object({
    meetingId: z.string(),
    participants: z.array(
        z.object({
            email: z.string().email(),
            role: z.enum(['ADMIN', 'COUNTER', 'PARTICIPANT']),
            isVotingEligible: z.boolean().default(true),
        }),
    ),
});

export const addParticipants = createServerFn({ method: 'POST' })
    .inputValidator(addParticipantsSchema)
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        const requested = Array.from(
            new Map(
                data.participants.map((item) => [item.email, item]),
            ).values(),
        );
        if (requested.length === 0) return { addedCount: 0 };

        const emails = requested.map((item) => item.email);
        const existingUsers = await db
            .select()
            .from(user)
            .where(inArray(user.email, emails));
        const usersByEmail = new Map(
            existingUsers.map((existingUser) => [
                existingUser.email,
                existingUser,
            ]),
        );
        const userIds = existingUsers.map((existingUser) => existingUser.id);

        const [existingParticipants, existingInvites] = await Promise.all([
            userIds.length > 0
                ? db
                      .select()
                      .from(participant)
                      .where(
                          and(
                              eq(participant.meetingId, data.meetingId),
                              inArray(participant.userId, userIds),
                          ),
                      )
                : Promise.resolve([]),
            db
                .select()
                .from(invite)
                .where(
                    and(
                        eq(invite.meetingId, data.meetingId),
                        inArray(invite.email, emails),
                    ),
                ),
        ]);

        const participantUserIds = new Set(
            existingParticipants.map((item) => item.userId),
        );
        const inviteEmails = new Set(existingInvites.map((item) => item.email));
        const participantsToAdd = requested.flatMap((item) => {
            const existingUser = usersByEmail.get(item.email);
            if (!existingUser || participantUserIds.has(existingUser.id)) {
                return [];
            }
            return [
                {
                    role: item.role,
                    isVotingEligible: item.isVotingEligible,
                    isApproved: true,
                    userId: existingUser.id,
                    meetingId: data.meetingId,
                },
            ];
        });
        const invitesToAdd = requested
            .filter(
                (item) =>
                    !usersByEmail.has(item.email) &&
                    !inviteEmails.has(item.email),
            )
            .map((item) => ({ ...item, meetingId: data.meetingId }));

        await Promise.all([
            participantsToAdd.length > 0
                ? db.insert(participant).values(participantsToAdd)
                : Promise.resolve(),
            invitesToAdd.length > 0
                ? db.insert(invite).values(invitesToAdd)
                : Promise.resolve(),
        ]);

        return {
            addedCount: participantsToAdd.length + invitesToAdd.length,
        };
    });

const updateParticipantSchema = z.object({
    meetingId: z.string(),
    participantId: z.string(),
    role: z.enum(['ADMIN', 'COUNTER', 'PARTICIPANT']).optional(),
    isVotingEligible: z.boolean().optional(),
});

export const updateParticipant = createServerFn({ method: 'POST' })
    .inputValidator(updateParticipantSchema)
    .handler(async ({ data }) => {
        const { participant: caller } = await requireAdminOrCounter(
            data.meetingId,
        );

        // Counters can only change voting eligibility, not roles
        if (caller.role === 'COUNTER' && data.role !== undefined) {
            throw new Error('Tellekorps kan ikke endre roller');
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

        return updated;
    });

const bulkUpdateVotingEligibilitySchema = z.object({
    meetingId: z.string(),
    participantIds: z.array(z.string()),
    isVotingEligible: z.boolean(),
});

export const bulkUpdateVotingEligibility = createServerFn({ method: 'POST' })
    .inputValidator(bulkUpdateVotingEligibilitySchema)
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        if (data.participantIds.length > 0) {
            await db
                .update(participant)
                .set({ isVotingEligible: data.isVotingEligible })
                .where(inArray(participant.id, data.participantIds));
        }

        return { updatedCount: data.participantIds.length };
    });

export const deleteParticipants = createServerFn({ method: 'POST' })
    .inputValidator(
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

        return { success: true };
    });

export const registerAsParticipant = createServerFn({ method: 'POST' })
    .inputValidator(z.object({ meetingId: z.string() }))
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
    .inputValidator(
        z.object({ meetingId: z.string(), participantId: z.string() }),
    )
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
        publish(liveEvents.meetingParticipantsUpdated(data.meetingId), {});

        return updated;
    });

export const denyParticipant = createServerFn({ method: 'POST' })
    .inputValidator(
        z.object({ meetingId: z.string(), participantId: z.string() }),
    )
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
