import { z } from 'zod';

export interface LiveEvent<TSchema extends z.ZodType = z.ZodType> {
    channel: string;
    schema: TSchema;
}

function event<TSchema extends z.ZodType>(
    channel: string,
    schema: TSchema,
): LiveEvent<TSchema> {
    return { channel, schema };
}

const emptyPayload = z.object({});
const voteCount = z.object({
    voteCount: z.number().int().nonnegative(),
    votingEligibleCount: z.number().int().nonnegative(),
});
const reviewCounts = z.object({
    approved: z.number().int().nonnegative(),
    disapproved: z.number().int().nonnegative(),
});

export const liveEvents = {
    meetingVotationOpened: (meetingId: string) =>
        event(
            `meeting:${meetingId}:votation-opened`,
            z.object({ votationId: z.string() }),
        ),
    meetingVotationsUpdated: (meetingId: string) =>
        event(`meeting:${meetingId}:votations-updated`, emptyPayload),
    meetingParticipantPending: (meetingId: string) =>
        event(
            `meeting:${meetingId}:participant-pending`,
            z.object({
                participantId: z.string(),
                userName: z.string(),
            }),
        ),
    meetingParticipantsUpdated: (meetingId: string) =>
        event(`meeting:${meetingId}:participants-updated`, emptyPayload),
    participantStatus: (userId: string, meetingId: string) =>
        event(
            `participant:${userId}:status:${meetingId}`,
            z.union([
                z.object({ approved: z.literal(true) }),
                z.object({ denied: z.literal(true) }),
            ]),
        ),
    votationStatus: (votationId: string) =>
        event(
            `votation:${votationId}:status`,
            z.object({
                votationId: z.string(),
                votationStatus: z.enum([
                    'UPCOMING',
                    'OPEN',
                    'CHECKING_RESULT',
                    'PUBLISHED_RESULT',
                    'INVALID',
                ]),
            }),
        ),
    votationVotes: (votationId: string) =>
        event(`votation:${votationId}:votes`, voteCount),
    votationReviews: (votationId: string) =>
        event(`votation:${votationId}:reviews`, reviewCounts),
};

export type LiveEventData<TEvent extends LiveEvent> = z.output<
    TEvent['schema']
>;
