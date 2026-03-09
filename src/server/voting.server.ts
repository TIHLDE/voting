import { eq, and, count } from 'drizzle-orm'
import { votation, hasVoted, participant } from '#/db/schema.ts'
import { db } from '#/db/index.ts'

export async function ensureNotVoted(userId: string, votationId: string) {
  const [existing] = await db
    .select()
    .from(hasVoted)
    .where(
      and(eq(hasVoted.userId, userId), eq(hasVoted.votationId, votationId))
    )
  if (existing) throw new Error('Du har allerede stemt i denne voteringen')
}

export async function ensureVotationOpen(votationId: string) {
  const v = await db.query.votation.findFirst({
    where: eq(votation.id, votationId),
  })
  if (!v) throw new Error('Voteringen finnes ikke')
  if (v.status !== 'OPEN') throw new Error('Voteringen er ikke åpen')
  return v
}

export async function getVoteCountData(votationId: string, meetingId: string) {
  const [voteCountResult] = await db
    .select({ count: count() })
    .from(hasVoted)
    .where(eq(hasVoted.votationId, votationId))

  const [eligibleResult] = await db
    .select({ count: count() })
    .from(participant)
    .where(
      and(
        eq(participant.meetingId, meetingId),
        eq(participant.isVotingEligible, true)
      )
    )

  return {
    voteCount: voteCountResult.count,
    votingEligibleCount: eligibleResult.count,
  }
}
