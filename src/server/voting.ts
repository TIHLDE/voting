import { createServerFn } from '@tanstack/react-start';
import { eq, and, count, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
    votation,
    alternative,
    hasVoted,
    vote,
    stvVote,
    votationResultReview,
    votationResult,
    meeting,
    participant,
} from '#/db/schema';
import { validateStatusTransition } from './votation-state';
import { publish } from './sse/emitter';
import { liveEvents } from '#/lib/live-events';
import { validateStvRanking } from '#/lib/stv-ranking';
import { db } from '#/db/index';
import {
    requireAdmin,
    requireAdminOrCounter,
    requireParticipant,
    requireVotingEligible,
} from './permissions.server';
import { setWinner } from './results.server';
import {
    ensureNotVoted,
    ensureVotationOpen,
    getVoteCountData,
} from './voting.server';
import { requireAuth } from './auth-session.server';

export { getOpenVotation } from './votations';

export const getHasVoted = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        const session = await requireAuth();
        const [existing] = await db
            .select()
            .from(hasVoted)
            .where(
                and(
                    eq(hasVoted.userId, session.user.id),
                    eq(hasVoted.votationId, data.votationId),
                ),
            );
        return { hasVoted: !!existing };
    });

export const castVote = createServerFn({ method: 'POST' })
    .validator(z.object({ alternativeId: z.string() }))
    .handler(async ({ data }) => {
        const alt = await db.query.alternative.findFirst({
            where: { id: data.alternativeId },
            with: { votation: true },
        });
        if (!alt) throw new Error('Alternativet finnes ikke');

        const v = await ensureVotationOpen(alt.votationId);
        const { session } = await requireVotingEligible(v.meetingId);
        await ensureNotVoted(session.user.id, alt.votationId);

        await db.transaction(async (tx) => {
            await tx.insert(hasVoted).values({
                userId: session.user.id,
                votationId: alt.votationId,
            });

            await tx.insert(vote).values({
                alternativeId: data.alternativeId,
            });
        });

        const counts = await getVoteCountData(alt.votationId, v.meetingId);
        publish(liveEvents.votationVotes(alt.votationId), counts);

        return { success: true };
    });

export const castBlankVote = createServerFn({ method: 'POST' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await ensureVotationOpen(data.votationId);
        if (!v.blankVotes) throw new Error('Blanke stemmer er ikke tillatt');

        const { session } = await requireVotingEligible(v.meetingId);
        await ensureNotVoted(session.user.id, data.votationId);

        await db.transaction(async (tx) => {
            await tx.insert(hasVoted).values({
                userId: session.user.id,
                votationId: data.votationId,
            });

            await tx
                .update(votation)
                .set({ blankVoteCount: v.blankVoteCount + 1 })
                .where(eq(votation.id, data.votationId));
        });

        const counts = await getVoteCountData(data.votationId, v.meetingId);
        publish(liveEvents.votationVotes(data.votationId), counts);

        return { success: true };
    });

export const castStvVote = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            votationId: z.string(),
            alternatives: z.array(
                z.object({
                    alternativeId: z.string(),
                    ranking: z.number(),
                }),
            ),
        }),
    )
    .handler(async ({ data }) => {
        const v = await ensureVotationOpen(data.votationId);
        if (v.type !== 'STV') throw new Error('Denne voteringen er ikke STV');

        // Blank votes go through castBlankVote, so every ballot here must
        // be a complete ranking of the votation's alternatives
        const alts = await db.query.alternative.findMany({
            where: { votationId: data.votationId },
        });
        const rankingError = validateStvRanking(
            data.alternatives,
            alts.map((a) => a.id),
        );
        if (rankingError) throw new Error(rankingError);

        const { session } = await requireVotingEligible(v.meetingId);
        await ensureNotVoted(session.user.id, data.votationId);

        await db.transaction(async (tx) => {
            await tx.insert(hasVoted).values({
                userId: session.user.id,
                votationId: data.votationId,
            });

            const [newStvVote] = await tx
                .insert(stvVote)
                .values({ votationId: data.votationId })
                .returning();

            await tx.insert(vote).values(
                data.alternatives.map((a) => ({
                    alternativeId: a.alternativeId,
                    ranking: a.ranking,
                    stvVoteId: newStvVote.id,
                })),
            );
        });

        const counts = await getVoteCountData(data.votationId, v.meetingId);
        publish(liveEvents.votationVotes(data.votationId), counts);

        return { success: true };
    });

export const startNextVotation = createServerFn({ method: 'POST' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireAdmin(data.meetingId);

        // Check no votation is currently open
        const openVotation = await db.query.votation.findFirst({
            where: { meetingId: data.meetingId, status: 'OPEN' },
        });
        if (openVotation) {
            throw new Error('Det er allerede en åpen votering');
        }

        // Find next UPCOMING votation
        const next = await db.query.votation.findFirst({
            where: { meetingId: data.meetingId, status: 'UPCOMING' },
            orderBy: { index: 'asc' },
            with: { alternatives: true },
        });

        if (!next) {
            throw new Error('Ingen kommende voteringer');
        }

        if (next.alternatives.length === 0) {
            throw new Error('Voteringen har ingen alternativer');
        }

        // Auto-start meeting if still UPCOMING
        const m = await db.query.meeting.findFirst({
            where: { id: data.meetingId },
        });
        if (m?.status === 'UPCOMING') {
            await db
                .update(meeting)
                .set({ status: 'ONGOING' })
                .where(eq(meeting.id, data.meetingId));
        }

        await db
            .update(votation)
            .set({ status: 'OPEN' })
            .where(eq(votation.id, next.id));

        publish(liveEvents.meetingVotationOpened(data.meetingId), {
            votationId: next.id,
        });

        return { votationId: next.id };
    });

export const updateVotationStatus = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            votationId: z.string(),
            status: z.enum([
                'UPCOMING',
                'OPEN',
                'CHECKING_RESULT',
                'PUBLISHED_RESULT',
                'INVALID',
            ]),
        }),
    )
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireAdmin(v.meetingId);

        if (!validateStatusTransition(v.status, data.status)) {
            throw new Error(
                `Ugyldig statusovergang fra ${v.status} til ${data.status}`,
            );
        }

        // Compute results when closing voting
        if (data.status === 'CHECKING_RESULT') {
            await setWinner(data.votationId);
        }

        await db
            .update(votation)
            .set({ status: data.status })
            .where(eq(votation.id, data.votationId));

        publish(liveEvents.votationStatus(data.votationId), {
            votationId: data.votationId,
            votationStatus: data.status,
        });

        return { success: true };
    });

export const resetVotation = createServerFn({ method: 'POST' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');
        if (v.status !== 'CHECKING_RESULT') {
            throw new Error('Kan kun gjøre om voteringer som kontrolleres');
        }

        await requireAdmin(v.meetingId);

        // Clear all vote data
        await db.transaction(async (tx) => {
            // Delete votes for alternatives in this votation
            const alts = await tx.query.alternative.findMany({
                where: { votationId: data.votationId },
            });
            const altIds = alts.map((a) => a.id);

            if (altIds.length > 0) {
                await tx
                    .delete(vote)
                    .where(inArray(vote.alternativeId, altIds));
            }

            // Delete STV votes
            await tx
                .delete(stvVote)
                .where(eq(stvVote.votationId, data.votationId));

            // Delete hasVoted records
            await tx
                .delete(hasVoted)
                .where(eq(hasVoted.votationId, data.votationId));

            // Delete result (cascades to stvRoundResult + alternativeRoundVoteCount)
            await tx
                .delete(votationResult)
                .where(eq(votationResult.votationId, data.votationId));

            // Delete reviews
            await tx
                .delete(votationResultReview)
                .where(eq(votationResultReview.votationId, data.votationId));

            // Reset alternatives
            if (altIds.length > 0) {
                await tx
                    .update(alternative)
                    .set({ isWinner: false })
                    .where(inArray(alternative.id, altIds));
            }

            // Reset votation and immediately re-open
            await tx
                .update(votation)
                .set({ status: 'OPEN', blankVoteCount: 0 })
                .where(eq(votation.id, data.votationId));
        });

        // Notify all clients that voting restarted
        publish(liveEvents.votationStatus(data.votationId), {
            votationId: data.votationId,
            votationStatus: 'OPEN',
        });
        publish(liveEvents.meetingVotationOpened(v.meetingId), {
            votationId: data.votationId,
        });

        return { success: true };
    });

export const getVoteCount = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireParticipant(v.meetingId);
        return getVoteCountData(data.votationId, v.meetingId);
    });

export const reviewVotation = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            votationId: z.string(),
            approved: z.boolean(),
        }),
    )
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');
        if (v.status !== 'CHECKING_RESULT') {
            throw new Error('Voteringen er ikke i kontrollstatus');
        }

        const { participant: p } = await requireParticipant(v.meetingId);
        if (p.role !== 'ADMIN' && p.role !== 'COUNTER') {
            throw new Error(
                'Kun administratorer og tellere kan godkjenne resultater',
            );
        }

        // Upsert review
        await db
            .insert(votationResultReview)
            .values({
                votationId: data.votationId,
                participantId: p.id,
                approved: data.approved,
            })
            .onConflictDoUpdate({
                target: [
                    votationResultReview.votationId,
                    votationResultReview.participantId,
                ],
                set: { approved: data.approved },
            });

        // Get review counts
        const reviews = await db.query.votationResultReview.findMany({
            where: { votationId: data.votationId },
        });

        const approved = reviews.filter((r) => r.approved).length;
        const disapproved = reviews.filter((r) => !r.approved).length;

        publish(liveEvents.votationReviews(data.votationId), {
            approved,
            disapproved,
        });

        return { approved, disapproved };
    });

export const getReviews = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireAdminOrCounter(v.meetingId);

        const reviews = await db.query.votationResultReview.findMany({
            where: { votationId: data.votationId },
            with: { participant: { with: { user: true } } },
        });

        return reviews;
    });

export const getReviewCounts = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireParticipant(v.meetingId);

        const reviews = await db.query.votationResultReview.findMany({
            where: { votationId: data.votationId },
        });

        return {
            approved: reviews.filter((r) => r.approved).length,
            disapproved: reviews.filter((r) => !r.approved).length,
        };
    });

export const getVoteAudit = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
            with: {
                alternatives: {
                    orderBy: { index: 'asc' },
                },
            },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireAdminOrCounter(v.meetingId);

        // Get who voted
        const voters = await db.query.hasVoted.findMany({
            where: { votationId: data.votationId },
            with: { user: true },
        });

        // For STV: get anonymous ballots
        let ballots: Array<{
            id: string;
            rankings: Array<{ ranking: number; alternativeText: string }>;
        }> = [];

        if (v.type === 'STV') {
            const stvVotes = await db.query.stvVote.findMany({
                where: { votationId: data.votationId },
                with: {
                    votes: {
                        with: { alternative: true },
                        orderBy: { ranking: 'asc' },
                    },
                },
            });

            ballots = stvVotes.map((sv) => ({
                id: sv.id,
                rankings: sv.votes.map((vt) => ({
                    ranking: vt.ranking,
                    alternativeText: vt.alternative.text,
                })),
            }));
        }

        return {
            voters: voters.map((voter) => ({
                name: voter.user.name,
                email: voter.user.email,
                votedAt: voter.createdAt,
            })),
            type: v.type,
            ballots,
            blankVoteCount: v.blankVoteCount,
            totalVoters: voters.length,
        };
    });

export const getMyReview = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        const { participant: p } = await requireParticipant(v.meetingId);

        const [review] = await db
            .select()
            .from(votationResultReview)
            .where(
                and(
                    eq(votationResultReview.votationId, data.votationId),
                    eq(votationResultReview.participantId, p.id),
                ),
            );

        return review ?? null;
    });

export const getNotVotedParticipants = createServerFn({ method: 'GET' })
    .validator(z.object({ votationId: z.string() }))
    .handler(async ({ data }) => {
        const v = await db.query.votation.findFirst({
            where: { id: data.votationId },
        });
        if (!v) throw new Error('Voteringen finnes ikke');

        await requireAdminOrCounter(v.meetingId);

        // Get all voting-eligible participants
        const eligibleParticipants = await db.query.participant.findMany({
            where: {
                meetingId: v.meetingId,
                isVotingEligible: true,
                isApproved: true,
            },
            with: { user: true },
        });

        // Filter out admins (they can't vote)
        const nonAdminEligible = eligibleParticipants.filter(
            (p) => p.role !== 'ADMIN',
        );

        // Get who has voted
        const voters = await db.query.hasVoted.findMany({
            where: { votationId: data.votationId },
        });
        const votedUserIds = new Set(voters.map((voter) => voter.userId));

        // Return those who haven't voted
        const notVoted = nonAdminEligible.filter(
            (p) => !votedUserIds.has(p.userId),
        );

        return notVoted.map((p) => ({
            id: p.id,
            name: p.user.name,
            email: p.user.email,
        }));
    });

export const getReviewerCount = createServerFn({ method: 'GET' })
    .validator(z.object({ meetingId: z.string() }))
    .handler(async ({ data }) => {
        await requireAdminOrCounter(data.meetingId);

        const [result] = await db
            .select({ count: count() })
            .from(participant)
            .where(
                and(
                    eq(participant.meetingId, data.meetingId),
                    eq(participant.isApproved, true),
                    inArray(participant.role, ['ADMIN', 'COUNTER']),
                ),
            );

        return { total: result.count };
    });
