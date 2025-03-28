import { Meeting as MeetingModel, Participant as ParticipantModel } from '@prisma/client';
import { list, objectType } from 'nexus';
import { User } from '../../auth';
import { EXPOSED_USER_FIELDS } from '../../auth/utils';
import { Votation } from '../../votation';

export const ParticipantOrInvite = objectType({
    name: 'ParticipantOrInvite',
    definition: (t) => {
        t.nonNull.string('email');
        t.nonNull.field('role', { type: 'Role' });
        t.nonNull.boolean('isVotingEligible');
    },
});

export const Meeting = objectType({
    name: 'Meeting',
    definition: (t) => {
        t.nonNull.id('id');
        t.nonNull.string('title');
        t.nonNull.string('organization');
        t.nonNull.datetime('startTime');
        t.string('description');
        t.nonNull.boolean('allowSelfRegistration');
        t.field('owner', {
            type: User,
            resolve: async (source, __, ctx) => {
                const { ownerId } = source as MeetingModel;
                const user = await ctx.prisma.user.findUnique({ where: { id: ownerId } });
                if (!user) throw new Error('User does not exist.');
                return user;
            },
        });
        t.field('votations', {
            type: list(Votation),
            resolve: async (source, __, ctx) => {
                const { id } = source as MeetingModel;
                const votation = await ctx.prisma.votation.findMany({ where: { meetingId: id } });
                return votation;
            },
        });
        t.nonNull.field('status', { type: 'MeetingStatus' });
        t.nonNull.field('participants', {
            type: list(Participant),
            resolve: async (source, __, ctx) => {
                const { id } = source as MeetingModel;
                const participants = await ctx.prisma.participant.findMany({
                    where: {
                        meetingId: id,
                    },
                });
                if (!participants) throw new Error('Participants do not exist.');
                return participants;
            },
        });
    },
});

export const Participant = objectType({
    name: 'Participant',
    definition(t) {
        t.nonNull.field('role', { type: 'Role' });
        t.nonNull.boolean('isVotingEligible');
        t.field('user', {
            type: User,
            resolve: async (source, __, ctx) => {
                const { userId } = source as ParticipantModel;
                if (!userId) return null;
                const user = await ctx.prisma.user.findUnique({
                    where: { id: userId },
                    select: EXPOSED_USER_FIELDS,
                });
                return user;
            },
        });
    },
});

export * from './results';

