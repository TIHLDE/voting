import { eq, sql } from 'drizzle-orm';
import { db } from '#/db/index';
import { invite, participant } from '#/db/schema';
import { liveEvents } from '#/lib/live-events';
import { publish } from './sse/emitter';
import { getVoteCountData } from './voting.server';

/**
 * Tells admins and counters to refetch the participant list, tells each
 * affected user that their own participation changed, and refreshes the
 * eligible voter count of an open votation.
 */
export async function publishParticipantChanges(
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

export async function acceptPendingInvites(userId: string, email: string) {
    const meetingIds = await db.transaction(async (tx) => {
        const invites = await tx
            .delete(invite)
            .where(eq(sql`lower(${invite.email})`, email.toLowerCase()))
            .returning();
        if (invites.length === 0) return [];

        const invitesByMeeting = new Map(
            invites.map((inv) => [inv.meetingId, inv]),
        );

        await tx
            .insert(participant)
            .values(
                [...invitesByMeeting.values()].map((inv) => ({
                    role: inv.role,
                    isVotingEligible: inv.isVotingEligible,
                    isApproved: true,
                    userId,
                    meetingId: inv.meetingId,
                })),
            )
            .onConflictDoUpdate({
                target: [participant.userId, participant.meetingId],
                set: {
                    role: sql`excluded.role`,
                    isVotingEligible: sql`excluded.is_voting_eligible`,
                    isApproved: true,
                },
                setWhere: eq(participant.isApproved, false),
            });

        return [...invitesByMeeting.keys()];
    });

    for (const meetingId of meetingIds) {
        await publishParticipantChanges(meetingId, {
            userIds: [userId],
            status: 'updated',
        });
    }
}
