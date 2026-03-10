import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { meeting, participant } from '#/db/schema.ts';
import { db } from '#/db/index.ts';
import { requireAuth } from './auth-session.server.ts';
import { requireAdmin, requireOwner, requireParticipant } from './permissions.server.ts';

export const getMyMeetings = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireAuth();

  const myParticipations = await db.query.participant.findMany({
    where: eq(participant.userId, session.user.id),
    with: {
      meeting: {
        with: {
          owner: true,
        },
      },
    },
  });

  const meetings = myParticipations.map((p) => ({
    ...p.meeting,
    myRole: p.role,
    isOwner: p.meeting.ownerId === session.user.id,
  }));

  const ongoing = meetings.filter((m) => m.status === 'ONGOING');
  const upcoming = meetings.filter((m) => m.status === 'UPCOMING');
  const ended = meetings.filter((m) => m.status === 'ENDED');

  return { ongoing, upcoming, ended };
});

export const getMeetingById = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ meetingId: z.string() }))
  .handler(async ({ data }) => {
    await requireParticipant(data.meetingId);

    const m = await db.query.meeting.findFirst({
      where: eq(meeting.id, data.meetingId),
      with: {
        owner: true,
        participants: {
          with: { user: true },
        },
      },
    });

    if (!m) throw new Error('Møtet finnes ikke');
    return m;
  });

const createMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  organization: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().transform((s) => new Date(s)),
  allowSelfRegistration: z.boolean(),
});

export const createMeeting = createServerFn({ method: 'POST' })
  .inputValidator(createMeetingSchema)
  .handler(async ({ data }) => {
    const session = await requireAuth();

    return await db.transaction(async (tx) => {
      const [newMeeting] = await tx
        .insert(meeting)
        .values({
          title: data.title,
          organization: data.organization,
          description: data.description,
          startTime: data.startTime,
          allowSelfRegistration: data.allowSelfRegistration,
          ownerId: session.user.id,
        })
        .returning();

      await tx.insert(participant).values({
        role: 'ADMIN',
        isVotingEligible: true,
        userId: session.user.id,
        meetingId: newMeeting.id,
      });

      return newMeeting;
    });
  });

const updateMeetingSchema = z.object({
  meetingId: z.string(),
  title: z.string().min(1).max(255).optional(),
  organization: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  status: z.enum(['UPCOMING', 'ONGOING', 'ENDED']).optional(),
  allowSelfRegistration: z.boolean().optional(),
});

export const updateMeeting = createServerFn({ method: 'POST' })
  .inputValidator(updateMeetingSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.meetingId);

    const { meetingId, ...updates } = data;
    const [updated] = await db.update(meeting).set(updates).where(eq(meeting.id, meetingId)).returning();

    return updated;
  });

export const deleteMeeting = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ meetingId: z.string() }))
  .handler(async ({ data }) => {
    await requireOwner(data.meetingId);

    await db.delete(meeting).where(eq(meeting.id, data.meetingId));
    return { success: true };
  });
