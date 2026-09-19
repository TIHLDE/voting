import { queryOptions } from '@tanstack/react-query';
import { getMeetingById } from '#/server/meetings';
import { getPendingParticipants, getParticipants } from '#/server/participants';
import { getVotationResults } from '#/server/results';
import {
    getActiveVotationId,
    getVotationById,
    getVotationsForMeeting,
} from '#/server/votations';
import {
    getHasVoted,
    getMyReview,
    getNotVotedParticipants,
    getReviewCounts,
    getReviewerCount,
    getVoteCount,
} from '#/server/voting';

export const meetingQuery = (meetingId: string) =>
    queryOptions({
        queryKey: ['meeting', meetingId] as const,
        queryFn: () => getMeetingById({ data: { meetingId } }),
    });

export const votationsQuery = (meetingId: string) =>
    queryOptions({
        queryKey: ['votations', meetingId] as const,
        queryFn: () => getVotationsForMeeting({ data: { meetingId } }),
    });

export const activeVotationQuery = (meetingId: string) =>
    queryOptions({
        queryKey: ['activeVotation', meetingId] as const,
        queryFn: () => getActiveVotationId({ data: { meetingId } }),
    });

export const pendingParticipantsQuery = (meetingId: string) =>
    queryOptions({
        queryKey: ['pendingParticipants', meetingId] as const,
        queryFn: () => getPendingParticipants({ data: { meetingId } }),
    });

export const participantsQuery = (meetingId: string) =>
    queryOptions({
        queryKey: ['participants', meetingId] as const,
        queryFn: () => getParticipants({ data: { meetingId } }),
    });

export const votationQuery = (votationId: string) =>
    queryOptions({
        queryKey: ['votation', votationId] as const,
        queryFn: () => getVotationById({ data: { votationId } }),
    });

export const voteCountQuery = (votationId: string) =>
    queryOptions({
        queryKey: ['voteCount', votationId] as const,
        queryFn: () => getVoteCount({ data: { votationId } }),
    });

export const hasVotedQuery = (votationId: string) =>
    queryOptions({
        queryKey: ['hasVoted', votationId] as const,
        queryFn: () => getHasVoted({ data: { votationId } }),
    });

export const notVotedQuery = (votationId: string) =>
    queryOptions({
        queryKey: ['notVoted', votationId] as const,
        queryFn: () => getNotVotedParticipants({ data: { votationId } }),
    });

export const resultsQuery = (votationId: string) =>
    queryOptions({
        queryKey: ['results', votationId] as const,
        queryFn: () => getVotationResults({ data: { votationId } }),
    });

export const reviewCountsQuery = (votationId: string) =>
    queryOptions({
        queryKey: ['reviewCounts', votationId] as const,
        queryFn: () => getReviewCounts({ data: { votationId } }),
    });

export const reviewerCountQuery = (meetingId: string) =>
    queryOptions({
        queryKey: ['reviewerCount', meetingId] as const,
        queryFn: () => getReviewerCount({ data: { meetingId } }),
    });

export const myReviewQuery = (votationId: string) =>
    queryOptions({
        queryKey: ['myReview', votationId] as const,
        queryFn: () => getMyReview({ data: { votationId } }),
    });
