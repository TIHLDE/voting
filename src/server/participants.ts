import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { participant, invite, user, meeting } from '#/db/schema.ts'
import { db } from '#/db/index.ts'
import { requireAuth } from './auth-session.server.ts'
import { requireAdmin, requireParticipant } from './permissions.server.ts'

export const getParticipants = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ meetingId: z.string() }))
  .handler(async ({ data }) => {
    await requireAdmin(data.meetingId)

    const participants = await db.query.participant.findMany({
      where: eq(participant.meetingId, data.meetingId),
      with: { user: true },
    })

    const invites = await db.query.invite.findMany({
      where: eq(invite.meetingId, data.meetingId),
    })

    return { participants, invites }
  })

export const getMyParticipant = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ meetingId: z.string() }))
  .handler(async ({ data }) => {
    const result = await requireParticipant(data.meetingId)
    return result.participant
  })

const addParticipantsSchema = z.object({
  meetingId: z.string(),
  participants: z.array(
    z.object({
      email: z.string().email(),
      role: z.enum(['ADMIN', 'COUNTER', 'PARTICIPANT']),
      isVotingEligible: z.boolean().default(true),
    })
  ),
})

export const addParticipants = createServerFn({ method: 'POST' })
  .inputValidator(addParticipantsSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.meetingId)

    let addedCount = 0

    for (const p of data.participants) {
      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(user)
        .where(eq(user.email, p.email))

      if (existingUser) {
        // Check if already a participant
        const [existing] = await db
          .select()
          .from(participant)
          .where(
            and(
              eq(participant.userId, existingUser.id),
              eq(participant.meetingId, data.meetingId)
            )
          )

        if (!existing) {
          await db.insert(participant).values({
            role: p.role,
            isVotingEligible: p.isVotingEligible,
            userId: existingUser.id,
            meetingId: data.meetingId,
          })
          addedCount++
        }
      } else {
        // Create invite
        const [existing] = await db
          .select()
          .from(invite)
          .where(
            and(
              eq(invite.email, p.email),
              eq(invite.meetingId, data.meetingId)
            )
          )

        if (!existing) {
          await db.insert(invite).values({
            email: p.email,
            role: p.role,
            isVotingEligible: p.isVotingEligible,
            meetingId: data.meetingId,
          })
          addedCount++
        }
      }
    }

    return { addedCount }
  })

const updateParticipantSchema = z.object({
  meetingId: z.string(),
  participantId: z.string(),
  role: z.enum(['ADMIN', 'COUNTER', 'PARTICIPANT']).optional(),
  isVotingEligible: z.boolean().optional(),
})

export const updateParticipant = createServerFn({ method: 'POST' })
  .inputValidator(updateParticipantSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.meetingId)

    // Check owner protection
    const [p] = await db
      .select()
      .from(participant)
      .where(eq(participant.id, data.participantId))

    if (!p) throw new Error('Deltakeren finnes ikke')

    const [m] = await db
      .select()
      .from(meeting)
      .where(eq(meeting.id, data.meetingId))

    if (m && p.userId === m.ownerId) {
      throw new Error('Kan ikke endre eierens rolle')
    }

    const updates: Record<string, unknown> = {}
    if (data.role !== undefined) updates.role = data.role
    if (data.isVotingEligible !== undefined)
      updates.isVotingEligible = data.isVotingEligible

    const [updated] = await db
      .update(participant)
      .set(updates)
      .where(eq(participant.id, data.participantId))
      .returning()

    return updated
  })

export const deleteParticipants = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      meetingId: z.string(),
      participantIds: z.array(z.string()),
      inviteEmails: z.array(z.string()).optional(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.meetingId)

    const [m] = await db
      .select()
      .from(meeting)
      .where(eq(meeting.id, data.meetingId))

    for (const pid of data.participantIds) {
      const [p] = await db
        .select()
        .from(participant)
        .where(eq(participant.id, pid))

      if (p && m && p.userId === m.ownerId) {
        throw new Error('Kan ikke fjerne eieren av møtet')
      }

      await db.delete(participant).where(eq(participant.id, pid))
    }

    if (data.inviteEmails) {
      for (const email of data.inviteEmails) {
        await db
          .delete(invite)
          .where(
            and(
              eq(invite.email, email),
              eq(invite.meetingId, data.meetingId)
            )
          )
      }
    }

    return { success: true }
  })

export const registerAsParticipant = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ meetingId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const [m] = await db
      .select()
      .from(meeting)
      .where(eq(meeting.id, data.meetingId))

    if (!m) throw new Error('Møtet finnes ikke')
    if (!m.allowSelfRegistration)
      throw new Error('Selvregistrering er ikke aktivert')

    // Check if already a participant
    const [existing] = await db
      .select()
      .from(participant)
      .where(
        and(
          eq(participant.userId, session.user.id),
          eq(participant.meetingId, data.meetingId)
        )
      )

    if (existing) return existing

    const [newParticipant] = await db
      .insert(participant)
      .values({
        role: 'PARTICIPANT',
        isVotingEligible: true,
        userId: session.user.id,
        meetingId: data.meetingId,
      })
      .returning()

    return newParticipant
  })
