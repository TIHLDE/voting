import { defineRelations } from 'drizzle-orm';

import * as schema from './schema';

/**
 * RQB v2 relations (Drizzle 1.0). One dedicated place for all relations,
 * replacing the per-table `relations()` calls of RQB v1.
 */
export const relations = defineRelations(schema, (r) => ({
    user: {
        meetings: r.many.meeting(),
        participants: r.many.participant(),
        hasVoted: r.many.hasVoted(),
        sessions: r.many.session(),
        accounts: r.many.account(),
    },
    session: {
        user: r.one.user({
            from: r.session.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    account: {
        user: r.one.user({
            from: r.account.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    meeting: {
        owner: r.one.user({
            from: r.meeting.ownerId,
            to: r.user.id,
            optional: false,
        }),
        participants: r.many.participant(),
        invites: r.many.invite(),
        votations: r.many.votation(),
    },
    participant: {
        user: r.one.user({
            from: r.participant.userId,
            to: r.user.id,
            optional: false,
        }),
        meeting: r.one.meeting({
            from: r.participant.meetingId,
            to: r.meeting.id,
            optional: false,
        }),
        reviews: r.many.votationResultReview(),
    },
    invite: {
        meeting: r.one.meeting({
            from: r.invite.meetingId,
            to: r.meeting.id,
            optional: false,
        }),
    },
    votation: {
        meeting: r.one.meeting({
            from: r.votation.meetingId,
            to: r.meeting.id,
            optional: false,
        }),
        alternatives: r.many.alternative(),
        hasVoted: r.many.hasVoted(),
        stvVotes: r.many.stvVote(),
        result: r.one.votationResult(),
        reviews: r.many.votationResultReview(),
    },
    alternative: {
        votation: r.one.votation({
            from: r.alternative.votationId,
            to: r.votation.id,
            optional: false,
        }),
        votes: r.many.vote(),
        roundVoteCounts: r.many.alternativeRoundVoteCount(),
    },
    hasVoted: {
        user: r.one.user({
            from: r.hasVoted.userId,
            to: r.user.id,
            optional: false,
        }),
        votation: r.one.votation({
            from: r.hasVoted.votationId,
            to: r.votation.id,
            optional: false,
        }),
    },
    vote: {
        alternative: r.one.alternative({
            from: r.vote.alternativeId,
            to: r.alternative.id,
            optional: false,
        }),
        stvVote: r.one.stvVote({ from: r.vote.stvVoteId, to: r.stvVote.id }),
    },
    stvVote: {
        votation: r.one.votation({
            from: r.stvVote.votationId,
            to: r.votation.id,
            optional: false,
        }),
        votes: r.many.vote(),
    },
    votationResult: {
        votation: r.one.votation({
            from: r.votationResult.votationId,
            to: r.votation.id,
            optional: false,
        }),
        stvRoundResults: r.many.stvRoundResult(),
    },
    stvRoundResult: {
        result: r.one.votationResult({
            from: r.stvRoundResult.resultId,
            to: r.votationResult.votationId,
        }),
        alternativeVoteCounts: r.many.alternativeRoundVoteCount(),
    },
    alternativeRoundVoteCount: {
        alternative: r.one.alternative({
            from: r.alternativeRoundVoteCount.alternativeId,
            to: r.alternative.id,
            optional: false,
        }),
        stvRoundResult: r.one.stvRoundResult({
            from: r.alternativeRoundVoteCount.stvRoundResultId,
            to: r.stvRoundResult.id,
            optional: false,
        }),
    },
    votationResultReview: {
        votation: r.one.votation({
            from: r.votationResultReview.votationId,
            to: r.votation.id,
            optional: false,
        }),
        participant: r.one.participant({
            from: r.votationResultReview.participantId,
            to: r.participant.id,
            optional: false,
        }),
    },
}));
