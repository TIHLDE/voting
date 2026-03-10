import { eq, and } from 'drizzle-orm';
import { db } from '#/db/index.ts';
import { participant, meeting } from '#/db/schema.ts';
import { requireAuth } from './auth-session.server.ts';

export async function requireParticipant(meetingId: string) {
  const session = await requireAuth();
  const [p] = await db
    .select()
    .from(participant)
    .where(and(eq(participant.userId, session.user.id), eq(participant.meetingId, meetingId)));
  if (!p) {
    throw new Error('Du er ikke deltaker i dette møtet');
  }
  if (!p.isApproved) {
    throw new Error('Din deltakelse er ikke godkjent ennå');
  }
  return { session, participant: p };
}

export async function requireAdmin(meetingId: string) {
  const result = await requireParticipant(meetingId);
  if (result.participant.role !== 'ADMIN') {
    throw new Error('Du må være administrator for denne handlingen');
  }
  return result;
}

export async function requireOwner(meetingId: string) {
  const session = await requireAuth();
  const [m] = await db.select().from(meeting).where(eq(meeting.id, meetingId));
  if (!m) {
    throw new Error('Møtet finnes ikke');
  }
  if (m.ownerId !== session.user.id) {
    throw new Error('Kun eieren av møtet kan utføre denne handlingen');
  }
  return { session, meeting: m };
}

export async function requireVotingEligible(meetingId: string) {
  const result = await requireParticipant(meetingId);
  if (result.participant.role === 'ADMIN') {
    throw new Error('Administratorer kan ikke stemme');
  }
  if (!result.participant.isVotingEligible) {
    throw new Error('Du har ikke stemmerett i dette møtet');
  }
  return result;
}

export async function requireAdminOrCounter(meetingId: string) {
  const result = await requireParticipant(meetingId);
  if (result.participant.role !== 'ADMIN' && result.participant.role !== 'COUNTER') {
    throw new Error('Du må være administrator eller tellekorps for denne handlingen');
  }
  return result;
}
