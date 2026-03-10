import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum('role', ['ADMIN', 'COUNTER', 'PARTICIPANT']);

export const votationTypeEnum = pgEnum('votation_type', ['SIMPLE', 'QUALIFIED', 'STV']);

export const meetingStatusEnum = pgEnum('meeting_status', ['UPCOMING', 'ONGOING', 'ENDED']);

export const votationStatusEnum = pgEnum('votation_status', [
  'UPCOMING',
  'OPEN',
  'CHECKING_RESULT',
  'PUBLISHED_RESULT',
  'INVALID',
]);

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const meeting = pgTable('meeting', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: varchar('title', { length: 255 }).notNull(),
  organization: text('organization').notNull(),
  description: text('description'),
  startTime: timestamp('start_time').notNull(),
  status: meetingStatusEnum('status').notNull().default('UPCOMING'),
  allowSelfRegistration: boolean('allow_self_registration').notNull().default(false),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const participant = pgTable(
  'participant',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    role: roleEnum('role').notNull(),
    isVotingEligible: boolean('is_voting_eligible').notNull().default(true),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('participant_user_meeting_idx').on(t.userId, t.meetingId)],
);

export const invite = pgTable(
  'invite',
  {
    email: text('email').notNull(),
    role: roleEnum('role').notNull(),
    isVotingEligible: boolean('is_voting_eligible').notNull().default(true),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('invite_email_meeting_idx').on(t.email, t.meetingId)],
);

export const votation = pgTable('votation', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: votationStatusEnum('status').notNull().default('UPCOMING'),
  type: votationTypeEnum('type').notNull().default('SIMPLE'),
  blankVotes: boolean('blank_votes').notNull().default(false),
  blankVoteCount: integer('blank_vote_count').notNull().default(0),
  hiddenVotes: boolean('hidden_votes').notNull().default(false),
  numberOfWinners: integer('number_of_winners').notNull().default(1),
  majorityThreshold: integer('majority_threshold').notNull().default(50),
  index: integer('index').notNull(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meeting.id, { onDelete: 'cascade' }),
});

export const alternative = pgTable('alternative', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  text: varchar('text', { length: 120 }).notNull(),
  index: integer('index').notNull().default(0),
  isWinner: boolean('is_winner').notNull().default(false),
  votationId: text('votation_id')
    .notNull()
    .references(() => votation.id, { onDelete: 'cascade' }),
});

export const hasVoted = pgTable(
  'has_voted',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    votationId: text('votation_id')
      .notNull()
      .references(() => votation.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.votationId], name: 'has_voted_pk' })],
);

export const vote = pgTable('vote', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  alternativeId: text('alternative_id')
    .notNull()
    .references(() => alternative.id, { onDelete: 'cascade' }),
  ranking: integer('ranking').notNull().default(1),
  stvVoteId: text('stv_vote_id').references(() => stvVote.id, {
    onDelete: 'cascade',
  }),
});

export const stvVote = pgTable('stv_vote', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  votationId: text('votation_id')
    .notNull()
    .references(() => votation.id, { onDelete: 'cascade' }),
});

export const votationResult = pgTable('votation_result', {
  votationId: text('votation_id')
    .primaryKey()
    .references(() => votation.id, { onDelete: 'cascade' }),
  votingEligibleCount: integer('voting_eligible_count').notNull(),
  voteCount: integer('vote_count').notNull(),
  blankVoteCount: integer('blank_vote_count'),
  quota: doublePrecision('quota'),
});

export const stvRoundResult = pgTable('stv_round_result', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  index: integer('index').notNull(),
  resultId: text('result_id').references(() => votationResult.votationId, {
    onDelete: 'cascade',
  }),
});

export const alternativeRoundVoteCount = pgTable(
  'alternative_round_vote_count',
  {
    alternativeId: text('alternative_id')
      .notNull()
      .references(() => alternative.id, { onDelete: 'cascade' }),
    voteCount: doublePrecision('vote_count').notNull(),
    stvRoundResultId: text('stv_round_result_id')
      .notNull()
      .references(() => stvRoundResult.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({
      columns: [t.alternativeId, t.stvRoundResultId],
      name: 'alt_round_vote_count_pk',
    }),
  ],
);

export const votationResultReview = pgTable(
  'votation_result_review',
  {
    votationId: text('votation_id')
      .notNull()
      .references(() => votation.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => participant.id, { onDelete: 'cascade' }),
    approved: boolean('approved').notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.votationId, t.participantId],
      name: 'votation_result_review_pk',
    }),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  meetings: many(meeting),
  participants: many(participant),
  hasVoted: many(hasVoted),
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const meetingRelations = relations(meeting, ({ one, many }) => ({
  owner: one(user, { fields: [meeting.ownerId], references: [user.id] }),
  participants: many(participant),
  invites: many(invite),
  votations: many(votation),
}));

export const participantRelations = relations(participant, ({ one, many }) => ({
  user: one(user, {
    fields: [participant.userId],
    references: [user.id],
  }),
  meeting: one(meeting, {
    fields: [participant.meetingId],
    references: [meeting.id],
  }),
  reviews: many(votationResultReview),
}));

export const inviteRelations = relations(invite, ({ one }) => ({
  meeting: one(meeting, {
    fields: [invite.meetingId],
    references: [meeting.id],
  }),
}));

export const votationRelations = relations(votation, ({ one, many }) => ({
  meeting: one(meeting, {
    fields: [votation.meetingId],
    references: [meeting.id],
  }),
  alternatives: many(alternative),
  hasVoted: many(hasVoted),
  stvVotes: many(stvVote),
  result: one(votationResult),
  reviews: many(votationResultReview),
}));

export const alternativeRelations = relations(alternative, ({ one, many }) => ({
  votation: one(votation, {
    fields: [alternative.votationId],
    references: [votation.id],
  }),
  votes: many(vote),
  roundVoteCounts: many(alternativeRoundVoteCount),
}));

export const hasVotedRelations = relations(hasVoted, ({ one }) => ({
  user: one(user, { fields: [hasVoted.userId], references: [user.id] }),
  votation: one(votation, {
    fields: [hasVoted.votationId],
    references: [votation.id],
  }),
}));

export const voteRelations = relations(vote, ({ one }) => ({
  alternative: one(alternative, {
    fields: [vote.alternativeId],
    references: [alternative.id],
  }),
  stvVote: one(stvVote, {
    fields: [vote.stvVoteId],
    references: [stvVote.id],
  }),
}));

export const stvVoteRelations = relations(stvVote, ({ one, many }) => ({
  votation: one(votation, {
    fields: [stvVote.votationId],
    references: [votation.id],
  }),
  votes: many(vote),
}));

export const votationResultRelations = relations(votationResult, ({ one, many }) => ({
  votation: one(votation, {
    fields: [votationResult.votationId],
    references: [votation.id],
  }),
  stvRoundResults: many(stvRoundResult),
}));

export const stvRoundResultRelations = relations(stvRoundResult, ({ one, many }) => ({
  result: one(votationResult, {
    fields: [stvRoundResult.resultId],
    references: [votationResult.votationId],
  }),
  alternativeVoteCounts: many(alternativeRoundVoteCount),
}));

export const alternativeRoundVoteCountRelations = relations(alternativeRoundVoteCount, ({ one }) => ({
  alternative: one(alternative, {
    fields: [alternativeRoundVoteCount.alternativeId],
    references: [alternative.id],
  }),
  stvRoundResult: one(stvRoundResult, {
    fields: [alternativeRoundVoteCount.stvRoundResultId],
    references: [stvRoundResult.id],
  }),
}));

export const votationResultReviewRelations = relations(votationResultReview, ({ one }) => ({
  votation: one(votation, {
    fields: [votationResultReview.votationId],
    references: [votation.id],
  }),
  participant: one(participant, {
    fields: [votationResultReview.participantId],
    references: [participant.id],
  }),
}));
