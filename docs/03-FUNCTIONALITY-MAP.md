# Functionality Map & API Reference

## Vedtatt — Democratic Voting Platform

---

## 1. Application Flow Diagram

```
                                    ┌──────────────┐
                                    │  Front Page   │
                                    │  (Public)     │
                                    └──────┬───────┘
                                           │ Login (Auth0)
                                           ▼
                                    ┌──────────────┐
                                    │  My Meetings  │◄──────────────────────┐
                                    │  Dashboard    │                       │
                                    └──┬───────┬───┘                       │
                                       │       │                           │
                          ┌────────────┘       └────────────┐              │
                          ▼                                 ▼              │
                   ┌──────────────┐                  ┌──────────────┐      │
                   │ Create/Edit  │                  │Meeting Lobby │      │
                   │ Meeting      │                  │              │      │
                   │ (3-step)     │                  └──┬───┬───┬──┘      │
                   └──┬───┬───┬──┘                     │   │   │         │
                      │   │   │                        │   │   │         │
              ┌───────┘   │   └──────┐         ┌──────┘   │   └──────┐  │
              ▼           ▼          ▼         ▼           ▼          ▼  │
        ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌─────┐
        │ Meeting  ││ Votation ││Participant││Votation  ││ Active   ││Self │
        │ Details  ││ Editor   ││ Manager  ││ List     ││ Votation ││Reg. │
        └──────────┘└──────────┘└──────────┘└──────────┘└────┬─────┘└─────┘
                                                             │
                                            ┌────────┬───────┼────────┐
                                            ▼        ▼       ▼        ▼
                                       ┌────────┐┌───────┐┌──────┐┌───────┐
                                       │ Voting ││Check  ││Review││Results│
                                       │ UI     ││Result ││Phase ││Display│
                                       └────────┘└───────┘└──────┘└───────┘
```

---

## 2. Page-by-Page Functionality Map

### 2.1 Front Page (`/`)

| Feature       | Description                        | Auth Required |
| ------------- | ---------------------------------- | ------------- |
| Hero section  | Marketing copy + decorative images | No            |
| Login button  | Redirects to Auth0                 | No            |
| Feedback link | External form link                 | No            |
| Privacy PDF   | Downloadable document              | No            |
| Partner logos | Organization logos grid            | No            |

### 2.2 My Meetings (`/myMeetings`)

| Feature           | Description                          | Auth Required |
| ----------------- | ------------------------------------ | ------------- |
| Meeting list      | Grouped: Ongoing / Upcoming / Ended  | Yes           |
| Meeting card      | Title, time, status tag, admin badge | Yes           |
| Navigate to lobby | Click card → Meeting Lobby           | Yes           |
| Edit meeting      | Options menu → Wizard (admin only)   | Yes (Admin)   |
| Delete meeting    | Options menu → Confirm (owner only)  | Yes (Owner)   |

### 2.3 Manage Meeting (`/meeting/new`, `/meeting/:meetingId/edit`)

| Feature                  | Description                                                   | Auth Required |
| ------------------------ | ------------------------------------------------------------- | ------------- |
| **Step 1: Details**      | Organization, title, start time, description, self-reg toggle | Yes           |
| **Step 2: Votations**    | Create/edit/delete/reorder votations with alternatives        | Yes (Admin)   |
| **Step 3: Participants** | Invite by email/CSV, manage roles, self-reg settings          | Yes (Admin)   |
| Step navigation          | Previous / Next / Finish buttons with unsaved change warnings | Yes           |

### 2.4 Meeting Lobby (`/meeting/:meetingId`)

| Feature               | Description                                | Auth Required     |
| --------------------- | ------------------------------------------ | ----------------- |
| Meeting title         | Display + link to edit (admin)             | Yes (Participant) |
| Votation list         | Organized by status with real-time updates | Yes (Participant) |
| Active votation       | Auto-navigate when votation opens          | Yes (Participant) |
| Admin bar             | Presentation mode, tab navigation          | Yes (Admin)       |
| Self-registration tab | QR code + copy link                        | Yes (Admin)       |
| Manage participants   | Modal with full participant management     | Yes (Admin)       |
| Start next votation   | Opens the next UPCOMING votation           | Yes (Admin)       |

### 2.5 Active Votation (`/meeting/:meetingId` → active votation view)

| Feature                     | Description                                      | Auth Required       |
| --------------------------- | ------------------------------------------------ | ------------------- |
| **OPEN status**             |                                                  |                     |
| Alternative selection       | Shuffled list, single select (or ranked for STV) | Yes (Eligible)      |
| Blank vote                  | Optional blank vote button                       | Yes (Eligible)      |
| Cast vote                   | Submit vote atomically                           | Yes (Eligible)      |
| Live vote count             | Real-time X/Y display                            | Yes (Participant)   |
| Show my vote                | Toggle to reveal own vote after casting          | Yes (Participant)   |
| **CHECKING_RESULT status**  |                                                  |                     |
| Result display              | Winners + detailed table (Admin/Counter)         | Yes (Admin/Counter) |
| Review buttons              | Approve / Disapprove                             | Yes (Admin/Counter) |
| Review summary              | X approved, Y disapproved of Z counters          | Yes (Admin/Counter) |
| Waiting message             | Displayed for regular participants               | Yes (Participant)   |
| **PUBLISHED_RESULT status** |                                                  |                     |
| Winner announcement         | Celebration visual + winner name                 | Yes (Participant)   |
| Results table               | Full breakdown (if not hidden)                   | Yes (Participant)   |
| STV round details           | Per-round breakdown for STV                      | Yes (Participant)   |
| CSV download                | Export results                                   | Yes (Participant)   |
| Start next votation         | Admin button to continue                         | Yes (Admin)         |
| **INVALID status**          |                                                  |                     |
| Invalidation message        | "Votering avbrutt" + reason                      | Yes (Participant)   |

### 2.6 Self-Registration (`/meeting/:meetingId/register`)

| Feature             | Description                            | Auth Required |
| ------------------- | -------------------------------------- | ------------- |
| Auto-login redirect | Redirect to Auth0 if not authenticated | No → Yes      |
| Registration button | Register as PARTICIPANT                | Yes           |
| Redirect to lobby   | Navigate after registration            | Yes           |

### 2.7 My Profile (`/myProfile`)

| Feature         | Description                           | Auth Required |
| --------------- | ------------------------------------- | ------------- |
| Change password | Auth0 password change ticket          | Yes           |
| Delete account  | Confirmation → Auth0 + local deletion | Yes           |
| Privacy info    | Information about email usage         | Yes           |

### 2.8 About Us (`/about`)

| Feature           | Description                                | Auth Required |
| ----------------- | ------------------------------------------ | ------------- |
| Organization info | Partner descriptions                       | No            |
| Voting type guide | Expandable explanation of all voting types | No            |

---

## 3. GraphQL API Reference

### 3.1 Queries

| Query                         | Input                 | Returns                         | Access                                                  |
| ----------------------------- | --------------------- | ------------------------------- | ------------------------------------------------------- |
| `user`                        | —                     | `User \| UserNotFoundError`     | Authenticated                                           |
| `updateMyPassword`            | —                     | `String` (Auth0 ticket URL)     | Authenticated                                           |
| `meetings`                    | —                     | `[Meeting]!`                    | Authenticated                                           |
| `meetingById`                 | `meetingId: String!`  | `Meeting`                       | Participant of meeting                                  |
| `participants`                | `meetingId: String!`  | `[ParticipantOrInvite]`         | Admin of meeting                                        |
| `myParticipant`               | `meetingId: String!`  | `ParticipantOrInvite`           | Participant of meeting                                  |
| `numberOfUpcomingVotations`   | `meetingId: String!`  | `Int`                           | Participant of meeting                                  |
| `votationById`                | `votationId: String!` | `Votation`                      | Participant of votation's meeting                       |
| `getVoteCount`                | `votationId: String!` | `VoteCountResult`               | Participant of votation's meeting                       |
| `getOpenVotation`             | `meetingId: String!`  | `String` (votation ID or empty) | Participant of meeting                                  |
| `getVotationResults`          | `votationId: String!` | `VotationResults`               | Admin/Counter, or Participant if published + not hidden |
| `getStvResult`                | `votationId: String!` | `StvResult`                     | Admin/Counter, or Participant if published + not hidden |
| `result`                      | `votationId: String!` | `Result`                        | Admin/Counter, or Participant if published + not hidden |
| `getWinnerOfVotation`         | `votationId: String!` | `[Alternative]`                 | Result is published                                     |
| `resultsOfPublishedVotations` | `meetingId: String!`  | `[VotationWithWinner]`          | Participant of meeting                                  |
| `getReviews`                  | `votationId: String!` | `ReviewResult`                  | Admin of votation's meeting                             |
| `getMyReview`                 | `votationId: String!` | `VotationReview \| NoReview`    | Participant of votation's meeting                       |

### 3.2 Mutations

| Mutation                | Input                                                   | Returns                      | Access                                 |
| ----------------------- | ------------------------------------------------------- | ---------------------------- | -------------------------------------- |
| `createMeeting`         | `meeting: CreateMeetingInput!`                          | `Meeting`                    | Authenticated                          |
| `updateMeeting`         | `meeting: UpdateMeetingInput!`                          | `Meeting`                    | Admin of meeting                       |
| `deleteMeeting`         | `id: String!`                                           | `Meeting`                    | Owner of meeting                       |
| `addParticipants`       | `meetingId, participants: [ParticipantInput!]!`         | `Int`                        | Admin of meeting                       |
| `updateParticipant`     | `meetingId, participant: ParticipantInput!`             | `ParticipantOrInvite`        | Admin of meeting                       |
| `deleteParticipants`    | `meetingId, emails: [String!]!`                         | `[String]`                   | Admin of meeting                       |
| `registerAsParticipant` | `meetingId: String!`                                    | `Participant`                | Authenticated + self-reg enabled       |
| `createVotations`       | `meetingId, votations: [CreateVotationInput!]!`         | `[Votation]`                 | Admin of meeting                       |
| `updateVotations`       | `meetingId, votations: [UpdateVotationInput!]!`         | `[Votation]`                 | Admin of meeting (UPCOMING only)       |
| `updateVotationIndexes` | `meetingId, votations: [UpdateVotationIndexInput!]!`    | `[Votation]`                 | Admin of meeting (UPCOMING only)       |
| `deleteVotation`        | `votationId: String!`                                   | `String`                     | Admin of votation's meeting            |
| `deleteAlternatives`    | `ids: [String!]!`                                       | `[String]`                   | Admin of alternatives' meeting         |
| `startNextVotation`     | `meetingId: String!`                                    | `OpenVotationResult` (union) | Admin of meeting                       |
| `updateVotationStatus`  | `votationId, status: VotationStatus!`                   | `Votation`                   | Admin of votation's meeting            |
| `castVote`              | `alternativeId: String!`                                | `Vote`                       | Eligible + not voted + votation OPEN   |
| `castBlankVote`         | `votationId: String!`                                   | `String`                     | Eligible + not voted + votation OPEN   |
| `castStvVote`           | `votationId, alternatives: [StvVoteAlternativeInput!]!` | `String`                     | Eligible + not voted + votation OPEN   |
| `reviewVotation`        | `votationId, approved: Boolean!`                        | `String`                     | Admin or Counter of votation's meeting |
| `deleteMe`              | —                                                       | `String`                     | Authenticated                          |

### 3.3 Subscriptions

| Subscription               | Input               | Payload                                        | Purpose                              |
| -------------------------- | ------------------- | ---------------------------------------------- | ------------------------------------ |
| `votationOpenedForMeeting` | `meetingId`         | `String` (votation ID)                         | Notify when admin opens a votation   |
| `votationStatusUpdated`    | `id` (votation ID)  | `{votationId, votationStatus, reason}`         | Notify on any status change          |
| `newVoteRegistered`        | `votationId`        | `{votationId, voteCount, votingEligibleCount}` | Live vote count updates              |
| `reviewAdded`              | `votationId`        | `{approved, disapproved}`                      | Live review count updates            |
| `votationsUpdated`         | `meetingId`         | `[VotationWithAlternative]`                    | Notify when votations are modified   |
| `votationDeleted`          | `meetingId`         | `String` (votation ID)                         | Notify when a votation is deleted    |
| `participantUpdated`       | `meetingId, userId` | `{role, isVotingEligible}`                     | Notify when role/eligibility changes |

### 3.4 Input Types

```graphql
input CreateMeetingInput {
    organization: String!
    title: String!
    startTime: DateTime!
    description: String
    allowSelfRegistration: Boolean!
}

input UpdateMeetingInput {
    id: String!
    organization: String
    title: String
    startTime: DateTime
    description: String
    status: MeetingStatus
    allowSelfRegistration: Boolean
}

input ParticipantInput {
    email: String!
    role: Role!
    isVotingEligible: Boolean!
}

input CreateVotationInput {
    title: String!
    description: String
    blankVotes: Boolean!
    hiddenVotes: Boolean!
    type: VotationType!
    numberOfWinners: Int!
    majorityThreshold: Int!
    index: Int!
    alternatives: [CreateAlternativeInput!]
}

input UpdateVotationInput {
    id: String!
    title: String!
    description: String
    blankVotes: Boolean!
    hiddenVotes: Boolean!
    type: VotationType!
    numberOfWinners: Int!
    majorityThreshold: Int!
    index: Int!
    alternatives: [UpdateAlternativeInput!]
}

input UpdateVotationIndexInput {
    id: String!
    index: Int!
}

input CreateAlternativeInput {
    text: String!
    index: Int!
}

input UpdateAlternativeInput {
    id: String!
    text: String!
    index: Int!
}

input StvVoteAlternativeInput {
    alternativeId: String!
    ranking: Int!
}
```

---

## 4. Votation Status State Machine

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
              ┌──────────┐     startNextVotation    ┌──────────┐
              │ UPCOMING │ ─────────────────────►   │   OPEN   │
              └──────────┘                          └────┬─────┘
                                                         │
                                        ┌────────────────┼────────────────┐
                                        │                │                │
                                        ▼                ▼                │
                                  ┌──────────────┐ ┌──────────┐          │
                                  │CHECKING_RESULT│ │ INVALID  │◄─────────┘
                                  └──────┬───────┘ └──────────┘
                                         │                ▲
                                ┌────────┼────────┐       │
                                │        │        │       │
                                ▼        │        ▼       │
                          ┌──────────────┐  ┌──────────┐  │
                          │PUBLISHED_    │  │ INVALID  │──┘
                          │RESULT        │  └──────────┘
                          └──────────────┘
```

**Valid transitions:**

- `UPCOMING` → `OPEN` (via `startNextVotation` only)
- `OPEN` → `CHECKING_RESULT` (admin closes voting, results computed)
- `OPEN` → `INVALID` (admin invalidates, or participant deletes account)
- `CHECKING_RESULT` → `PUBLISHED_RESULT` (admin publishes)
- `CHECKING_RESULT` → `INVALID` (admin invalidates)

**Invalid transitions:**

- Cannot go back to `UPCOMING`
- Cannot directly open (must use `startNextVotation`)
- Cannot go from `PUBLISHED_RESULT` or `INVALID` to any other status

---

## 5. Voting Algorithm Details

### 5.1 Simple Majority

```
Winner = alternative with the most votes
If tied → no single winner declared
```

### 5.2 Qualified Majority

```
Winner = alternative where votes > (votingEligibleCount × majorityThreshold / 100)
If no alternative exceeds threshold → no winner
```

**Threshold values used in frontend:**

- 50% (`majorityThreshold = 50`)
- 67% (`majorityThreshold = 67`)

### 5.3 STV (Single Transferable Vote) — Droop Quota

```
1. quota = floor(totalBallots / (numberOfWinners + 1)) + 1

2. REPEAT for each round:
   a. Count first-preference (or transferred) votes for each remaining alternative
   b. IF any alternative ≥ quota:
      - Declare as WINNER
      - Redistribute surplus votes (weight = surplus / totalVotes for that alternative)
      - Surplus votes go to the next-ranked alternative on each ballot
   c. ELSE IF remaining alternatives ≤ seats to fill:
      - All remaining alternatives declared WINNERS
   d. ELSE:
      - Alternative(s) with fewest votes declared LOSER
      - If eliminating all tied losers would leave too few alternatives, randomly keep some
      - Redistribute loser's votes at full weight to next-ranked alternative

3. UNTIL enough winners found OR all alternatives processed

4. Store per-round data: vote counts, winners, losers
```

---

## 6. Real-time Event Flow

### 6.1 Voting Session Flow

```
Admin clicks "Start Next Votation"
    │
    ├──► Backend: UPCOMING → OPEN
    ├──► PubSub: VOTATION_OPENED_FOR_MEETING_{meetingId}
    │    └──► All participants auto-navigate to active votation
    │
    ▼
Participants cast votes
    │
    ├──► Backend: Create HasVoted + Vote (atomic transaction)
    ├──► PubSub: NEW_VOTE_REGISTERED_FOR_{votationId}
    │    └──► All participants see updated vote count
    │
    ▼
Admin clicks "Close Voting"
    │
    ├──► Backend: OPEN → CHECKING_RESULT, compute results
    ├──► PubSub: VOTATION_STATUS_UPDATED_FOR_{votationId}
    │    └──► Admins/Counters see results; Participants see waiting message
    │
    ▼
Counters/Admins review results
    │
    ├──► Backend: Upsert VotationResultReview
    ├──► PubSub: REVIEW_ADDED_FOR_{votationId}
    │    └──► All reviewers see updated approval counts
    │
    ▼
Admin clicks "Publish Results"
    │
    ├──► Backend: CHECKING_RESULT → PUBLISHED_RESULT
    ├──► PubSub: VOTATION_STATUS_UPDATED_FOR_{votationId}
    │    └──► All participants see results + winner celebration
    │
    ▼
Admin clicks "Start Next Votation" (cycle repeats)
```

### 6.2 Participant Management Flow

```
Admin changes participant role/eligibility
    │
    ├──► Backend: Update Participant record
    ├──► PubSub: PARTICIPANT_{userId}_{meetingId}_UPDATED
    │    └──► Affected user's UI updates (admin controls appear/disappear)
    │
    ▼
Admin creates/updates votations
    │
    ├──► Backend: CRUD operations
    ├──► PubSub: VOTATIONS_UPDATED_FOR_{meetingId}
    │    └──► All participants see updated votation list
```

---

## 7. Frontend Component Architecture

### 7.1 Component Hierarchy

```
App
├── Navbar
│   └── AvatarMenu
├── FrontPage
├── MyMeetings
│   └── MeetingList
│       └── MeetingCard
│           ├── ActionPopover (admin)
│           └── ResultsModal
├── ManageMeeting (3-step wizard)
│   ├── MeetingInformationForm (Step 1)
│   ├── VotationList (Step 2)
│   │   ├── VotationListSection
│   │   │   └── VotationForm (expanded editor)
│   │   │       ├── TitleDescriptionForm
│   │   │       ├── AlternativesForm
│   │   │       ├── VotationTypeSelect
│   │   │       └── CheckboxAlternatives
│   │   └── CollapsedVotation (collapsed row)
│   └── ManageParticipants (Step 3)
│       ├── AddParticipantByEmail
│       ├── AddParticipantByCSV
│       ├── ParticipantTable
│       ├── SearchBar
│       ├── SortSelect
│       ├── RoleSelect
│       ├── VotingEligibilitySwitch
│       ├── SelfRegistrationToggle
│       └── DeleteButton
├── MeetingLobby
│   ├── AdminBar
│   │   ├── NavButton
│   │   └── StartNextVotationButton
│   ├── QRRegistration
│   ├── VotationList (lobby mode)
│   │   ├── ActiveVotationRow
│   │   ├── UpcomingVotation
│   │   └── EndedVotationRow
│   └── ActiveVotation
│       ├── VotingForm
│       │   ├── AlternativeList (Simple/Qualified)
│       │   │   └── AlternativeButton
│       │   └── PreferenceAlternativeList (STV)
│       │       └── DraggableAlternative
│       ├── CheckResults (Admin/Counter)
│       │   ├── WinnerAndResultsTable
│       │   ├── ReviewButtons
│       │   └── ReviewStatus
│       ├── ResultsComponent (Published)
│       │   ├── RegularResultTable
│       │   ├── StvResultTable
│       │   └── DownloadResultButton
│       └── AdminVotationController
├── RegisterForMeeting
├── MyProfile
│   ├── ChangePassword
│   └── DeleteUser
└── AboutUs
    └── VotingTypeInfo (expandable)
```

### 7.2 Shared Components

| Component            | Usage                                     |
| -------------------- | ----------------------------------------- |
| `Loading`            | Spinner overlay for async operations      |
| `CustomAlertDialog`  | Reusable confirmation dialog (7 variants) |
| `CustomTag`          | Colored status/role labels                |
| `DateTimePicker`     | Norwegian-locale date+time picker         |
| `AutoResizeTextArea` | Growing textarea                          |
| `InformationModal`   | Info icon with popup explanation          |
| `PageContainer`      | Full-width page wrapper                   |
| `ResponsiveHStack`   | Responsive horizontal/vertical stack      |
| `CopyLinkButton`     | Copy to clipboard with toast              |
| `DeleteButton`       | Trash icon with tooltip                   |
| `DownloadButton`     | CSV download trigger                      |
| `BackButton`         | Navigation back arrow                     |
| `DownloadLink`       | Anchor with download attribute            |

---

## 8. Tech Stack Recommendations for Rebuild

### 8.1 What to Keep (Proven Patterns)

- **GraphQL API** — well-structured schema, good separation of concerns
- **Prisma ORM** — clean data model, good migration support
- **PostgreSQL** — reliable relational database
- **Redis PubSub** — efficient real-time messaging
- **Auth0 integration** — mature authentication
- **STV algorithm** — complex but well-implemented

### 8.2 Potential Upgrades

| Current                      | Potential Replacement                   | Reason                  |
| ---------------------------- | --------------------------------------- | ----------------------- |
| React 17 (CRA)               | React 19 / Next.js / Vite               | CRA is deprecated       |
| Chakra UI v1                 | Chakra UI v3 / Radix / shadcn/ui        | Modernize UI            |
| Apollo Client                | urql / TanStack Query + graphql-request | Lighter alternatives    |
| Apollo Server + Express      | Apollo Server v4 / Yoga / Mercurius     | Modern GraphQL servers  |
| Nexus (code-first)           | Pothos / gql.tada                       | More active maintenance |
| `subscriptions-transport-ws` | `graphql-ws`                            | Deprecated library      |
| `graphql-shield`             | Pothos auth plugin / custom middleware  | Tighter integration     |
| Turborepo                    | Nx / Turborepo (keep)                   | Either works            |
| Docker Compose               | Docker Compose (keep) / Kubernetes      | Depends on scale        |

### 8.3 Architecture Patterns to Preserve

1. **Role-based authorization** with fine-grained permission rules
2. **Ballot secrecy** — HasVoted separate from Vote
3. **Real-time subscriptions** for all state changes
4. **State machine** for votation status with validated transitions
5. **Invite system** — pre-registration invites converted on signup
6. **Atomic vote casting** — transaction-based voting
7. **STV with Droop quota** — complete ranked voting implementation

---

## 9. Database Schema (Prisma-compatible)

```prisma
// Core Models — copy-paste ready for new project

enum Role {
  ADMIN
  PARTICIPANT
  COUNTER
}

enum VotationType {
  QUALIFIED
  SIMPLE
  STV
}

enum MeetingStatus {
  UPCOMING
  ONGOING
  ENDED
}

enum VotationStatus {
  UPCOMING
  OPEN
  CHECKING_RESULT
  PUBLISHED_RESULT
  INVALID
}

model User {
  id            String        @id @default(cuid())
  email         String        @unique @db.VarChar(255)
  emailVerified Boolean       @default(false)
  password      String
  meetings      Meeting[]     // meetings owned
  participantAt Participant[]
  hasVoted      HasVoted[]
}

model Meeting {
  id                    String        @id @default(cuid())
  organization          String
  title                 String        @db.VarChar(255)
  startTime             DateTime
  description           String?
  owner                 User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId               String
  votations             Votation[]
  status                MeetingStatus @default(UPCOMING)
  allowSelfRegistration Boolean       @default(false)
  participants          Participant[]
  invites               Invite[]
}

model Participant {
  id               String                 @id @default(cuid())
  role             Role
  userId           String
  meetingId        String
  isVotingEligible Boolean                @default(true)
  user             User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  meeting          Meeting                @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  reviews          VotationResultReview[]
  @@unique([userId, meetingId])
}

model Invite {
  email            String
  role             Role
  isVotingEligible Boolean
  meetingId        String
  meeting          Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  @@unique([email, meetingId])
}

model Votation {
  id                String               @id @default(cuid())
  title             String               @db.VarChar(255)
  description       String?
  status            VotationStatus       @default(UPCOMING)
  blankVotes        Boolean
  blankVoteCount    Int                  @default(0)
  hiddenVotes       Boolean
  type              VotationType         @default(SIMPLE)
  numberOfWinners   Int                  @default(1)
  majorityThreshold Int
  index             Int
  meetingId         String
  meeting           Meeting              @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  alternatives      Alternative[]
  hasVoted          HasVoted[]
  stvVotes          StvVote[]
  result            VotationResult?
  reviews           VotationResultReview[]
}

model HasVoted {
  votationId String
  userId     String
  createdAt  DateTime @default(now())
  votation   Votation @relation(fields: [votationId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, votationId])
}

model Alternative {
  id         String   @id @default(cuid())
  text       String   @db.VarChar(120)
  index      Int      @default(0)
  votationId String
  votation   Votation @relation(fields: [votationId], references: [id], onDelete: Cascade)
  isWinner   Boolean  @default(false)
  votes      Vote[]
  roundVoteCounts AlternativeRoundVoteCount[]
}

model Vote {
  id            String       @id @default(cuid())
  alternativeId String
  alternative   Alternative  @relation(fields: [alternativeId], references: [id], onDelete: Cascade)
  ranking       Int          @default(1)
  stvVoteId     String?
  stvVote       StvVote?     @relation(fields: [stvVoteId], references: [id], onDelete: Cascade)
}

model StvVote {
  id         String   @id @default(cuid())
  votationId String
  votation   Votation @relation(fields: [votationId], references: [id], onDelete: Cascade)
  votes      Vote[]
}

model VotationResult {
  votationId          String           @id
  votation            Votation         @relation(fields: [votationId], references: [id], onDelete: Cascade)
  votingEligibleCount Int
  voteCount           Int
  blankVoteCount      Int?
  quota               Float?
  stvRoundResults     StvRoundResult[]
}

model StvRoundResult {
  id       String           @id @default(cuid())
  index    Int
  resultId String?
  result   VotationResult?  @relation(fields: [resultId], references: [votationId], onDelete: Cascade)
  alternativeVoteCounts AlternativeRoundVoteCount[]
}

model AlternativeRoundVoteCount {
  alternativeId    String
  alternative      Alternative    @relation(fields: [alternativeId], references: [id], onDelete: Cascade)
  voteCount        Float
  stvRoundResultId String
  stvRoundResult   StvRoundResult @relation(fields: [stvRoundResultId], references: [id], onDelete: Cascade)
  @@id([alternativeId, stvRoundResultId])
}

model VotationResultReview {
  votationId    String
  votation      Votation    @relation(fields: [votationId], references: [id], onDelete: Cascade)
  participantId String
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  approved      Boolean
  @@id([votationId, participantId])
}
```

---

## 10. Key Business Rules Summary

1. **One open votation at a time** — A meeting can only have one votation with status OPEN
2. **Ballot secrecy** — HasVoted records WHO voted; Vote records WHAT was voted; they are never directly linked
3. **Owner immutability** — The meeting owner cannot be removed or demoted
4. **Invite conversion** — When a user registers, all matching email invites become Participant records
5. **Account deletion safety** — Deleting a user invalidates all their open votations
6. **Votation editing lock** — Only UPCOMING votations can be edited
7. **Alternative randomization** — Alternatives are shuffled on the frontend to prevent order bias
8. **STV blank votes** — STV does not support blank votes (UI hides the option)
9. **Hidden votes** — When enabled, only Admins and Counters can see detailed results
10. **Email notification** — Participants receive email when added to a meeting
11. **Self-registration guard** — Only meetings with `allowSelfRegistration = true` allow link/QR registration
12. **Qualified majority** — Requires exceeding a % of ALL eligible voters, not just votes cast
