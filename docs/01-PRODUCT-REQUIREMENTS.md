# Product Requirements Document (PRD)

## Vedtatt — Democratic Voting Platform

**Version:** 1.0
**Date:** 2026-03-09
**Status:** Reference Documentation (based on existing application analysis)

---

## 1. Product Overview

### 1.1 Purpose

Vedtatt is a web-based platform for conducting formal democratic voting processes (elections, resolutions, board decisions) within organizations. It enables meeting administrators to create meetings, define votations (ballots), invite participants, and run real-time voting sessions with live result tabulation.

### 1.2 Target Users

- **Student organizations** (e.g., TIHLDE, Velferdstinget, NSO)
- **Non-profit organizations** needing formal general assembly voting
- **Any organization** requiring auditable, structured democratic decision-making

### 1.3 Product Vision

> "Gjennomfør effektive og gode demokratiske prosesser" — Conduct effective and good democratic processes.

Replace manual/paper-based voting in organizational meetings with a digital, real-time, auditable system that supports multiple voting methods including Single Transferable Vote (STV).

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────┐     GraphQL (HTTP + WS)      ┌──────────────────────┐
│   Frontend (SPA)    │ ◄──────────────────────────► │   Backend (API)      │
│   React + Chakra UI │                              │   Node.js + Nexus    │
└─────────────────────┘                              └──────┬───────────────┘
                                                            │
                              ┌──────────────────────┐      │
                              │   Auth0 (Identity)   │◄─────┤
                              └──────────────────────┘      │
                                                            │
                              ┌──────────────────────┐      │
                              │   PostgreSQL (Data)  │◄─────┤
                              └──────────────────────┘      │
                                                            │
                              ┌──────────────────────┐      │
                              │   Redis (PubSub)     │◄─────┘
                              └──────────────────────┘
```

### 2.2 Current Tech Stack

| Layer              | Technology                                                         |
| ------------------ | ------------------------------------------------------------------ |
| Frontend Framework | React 17 (Create React App)                                        |
| UI Library         | Chakra UI                                                          |
| State/Data         | Apollo Client (GraphQL)                                            |
| Authentication     | Auth0 (OAuth2 / OIDC)                                              |
| API Layer          | GraphQL (Apollo Server + Express)                                  |
| Schema Builder     | Nexus                                                              |
| ORM                | Prisma                                                             |
| Database           | PostgreSQL                                                         |
| Real-time          | GraphQL Subscriptions (WebSocket via `subscriptions-transport-ws`) |
| PubSub Broker      | Redis (via `graphql-redis-subscriptions`)                          |
| Email              | Nodemailer (SMTP)                                                  |
| Monorepo           | Turborepo                                                          |
| Containerization   | Docker Compose                                                     |

---

## 3. Data Model

### 3.1 Entity Relationship Diagram (Conceptual)

```
User ──────── 1:N ──── Meeting (as owner)
  │                       │
  │                       ├── 1:N ── Votation
  │                       │            ├── 1:N ── Alternative
  │                       │            ├── 1:N ── HasVoted
  │                       │            ├── 1:N ── StvVote ── 1:N ── Vote
  │                       │            ├── 0:1 ── VotationResult
  │                       │            └── 1:N ── VotationResultReview
  │                       │
  │                       ├── 1:N ── Participant ──── N:1 ── User
  │                       │
  │                       └── 1:N ── Invite (pre-registration)
  │
  └──── 1:N ──── Participant (joins via meeting)
```

### 3.2 Core Entities

#### User

| Field         | Type            | Description                          |
| ------------- | --------------- | ------------------------------------ |
| id            | String (CUID)   | Primary key, derived from Auth0 sub  |
| email         | String (unique) | User's email address                 |
| emailVerified | Boolean         | Whether email has been verified      |
| password      | String          | Legacy field (empty for Auth0 users) |

#### Meeting

| Field                 | Type              | Description                            |
| --------------------- | ----------------- | -------------------------------------- |
| id                    | String (CUID)     | Primary key                            |
| title                 | String (max 255)  | Meeting title                          |
| organization          | String            | Name of the organizing body            |
| description           | String (optional) | Meeting description                    |
| startTime             | DateTime          | Scheduled start time                   |
| status                | Enum              | `UPCOMING` \| `ONGOING` \| `ENDED`     |
| ownerId               | FK → User         | The user who created the meeting       |
| allowSelfRegistration | Boolean           | Whether participants can self-register |

#### Participant

| Field            | Type          | Description                                  |
| ---------------- | ------------- | -------------------------------------------- |
| id               | String (CUID) | Primary key                                  |
| role             | Enum          | `ADMIN` \| `COUNTER` \| `PARTICIPANT`        |
| userId           | FK → User     | The user                                     |
| meetingId        | FK → Meeting  | The meeting                                  |
| isVotingEligible | Boolean       | Whether participant can vote (default: true) |

**Unique constraint:** (userId, meetingId)

#### Invite

| Field            | Type         | Description          |
| ---------------- | ------------ | -------------------- |
| email            | String       | Email of the invitee |
| role             | Enum         | Assigned role        |
| isVotingEligible | Boolean      | Voting eligibility   |
| meetingId        | FK → Meeting | The meeting          |

**Unique constraint:** (email, meetingId)

**Behavior:** When an invited user signs up, their invites are automatically converted to Participant records.

#### Votation (Ballot)

| Field             | Type              | Description                                                                  |
| ----------------- | ----------------- | ---------------------------------------------------------------------------- |
| id                | String (CUID)     | Primary key                                                                  |
| title             | String (max 255)  | Votation title                                                               |
| description       | String (optional) | Detailed description                                                         |
| status            | Enum              | `UPCOMING` \| `OPEN` \| `CHECKING_RESULT` \| `PUBLISHED_RESULT` \| `INVALID` |
| type              | Enum              | `SIMPLE` \| `QUALIFIED` \| `STV`                                             |
| blankVotes        | Boolean           | Whether blank votes are allowed                                              |
| blankVoteCount    | Int               | Running count of blank votes                                                 |
| hiddenVotes       | Boolean           | Whether results are hidden from regular participants                         |
| numberOfWinners   | Int               | Number of winners (relevant for STV)                                         |
| majorityThreshold | Int               | Percentage threshold for qualified majority                                  |
| index             | Int               | Display/execution order within meeting                                       |
| meetingId         | FK → Meeting      | Parent meeting                                                               |

#### Alternative (Voting Option)

| Field      | Type             | Description                |
| ---------- | ---------------- | -------------------------- |
| id         | String (CUID)    | Primary key                |
| text       | String (max 120) | Alternative text           |
| index      | Int              | Display order              |
| votationId | FK → Votation    | Parent votation            |
| isWinner   | Boolean          | Whether declared as winner |

#### Vote

| Field         | Type                    | Description                             |
| ------------- | ----------------------- | --------------------------------------- |
| id            | String (CUID)           | Primary key                             |
| alternativeId | FK → Alternative        | The chosen alternative                  |
| ranking       | Int                     | Preference ranking (for STV, default 1) |
| stvVoteId     | FK → StvVote (optional) | STV ballot group                        |

#### HasVoted (Audit Trail)

| Field      | Type          | Description  |
| ---------- | ------------- | ------------ |
| votationId | FK → Votation | Composite PK |
| userId     | FK → User     | Composite PK |
| createdAt  | DateTime      | Timestamp    |

**Purpose:** Tracks who has voted without linking to their actual vote (ballot secrecy).

#### VotationResult

| Field               | Type             | Description                                   |
| ------------------- | ---------------- | --------------------------------------------- |
| votationId          | FK → Votation    | Primary key                                   |
| votingEligibleCount | Int              | Snapshot of eligible voters at time of result |
| voteCount           | Int              | Total votes cast                              |
| blankVoteCount      | Int (optional)   | Blank votes if enabled                        |
| quota               | Float (optional) | STV quota (Droop quota)                       |

#### VotationResultReview

| Field         | Type             | Description                          |
| ------------- | ---------------- | ------------------------------------ |
| votationId    | FK → Votation    | Composite PK                         |
| participantId | FK → Participant | Composite PK                         |
| approved      | Boolean          | Whether reviewer approved the result |

### 3.3 Enumerations

#### Role

- `ADMIN` — Can manage the meeting, votations, participants, and control voting flow
- `COUNTER` — Can review/approve voting results (vote counters / "tellere")
- `PARTICIPANT` — Can vote and view published results

#### VotationType

- `SIMPLE` — Simple majority (most votes wins)
- `QUALIFIED` — Qualified majority (must exceed a percentage threshold of eligible voters)
- `STV` — Single Transferable Vote (ranked preference voting)

#### MeetingStatus

- `UPCOMING` — Scheduled but not started
- `ONGOING` — Currently in progress
- `ENDED` — Meeting has concluded

#### VotationStatus (State Machine)

```
UPCOMING → OPEN → CHECKING_RESULT → PUBLISHED_RESULT
                 ↘ INVALID ↙
```

- `UPCOMING` — Not yet opened for voting
- `OPEN` — Currently accepting votes
- `CHECKING_RESULT` — Votes closed, results being reviewed by admins/counters
- `PUBLISHED_RESULT` — Results published to all participants
- `INVALID` — Votation was invalidated/cancelled

---

## 4. Roles & Permissions

### 4.1 Role Matrix

| Action                         | ADMIN         | COUNTER       | PARTICIPANT   | Owner (special) |
| ------------------------------ | ------------- | ------------- | ------------- | --------------- |
| Create meeting                 | ✅ (any user) | ✅ (any user) | ✅ (any user) | Auto-assigned   |
| Update meeting                 | ✅            | ❌            | ❌            | ✅              |
| Delete meeting                 | ❌            | ❌            | ❌            | ✅ (only)       |
| Create/Update/Delete votations | ✅            | ❌            | ❌            | ✅              |
| Manage participants            | ✅            | ❌            | ❌            | ✅              |
| Start next votation            | ✅            | ❌            | ❌            | ✅              |
| Update votation status         | ✅            | ❌            | ❌            | ✅              |
| Cast vote                      | ✅\*          | ✅\*          | ✅\*          | ✅\*            |
| View live vote count           | ✅            | ✅            | ✅            | ✅              |
| Review/Approve results         | ✅            | ✅            | ❌            | ✅              |
| View detailed results          | ✅            | ✅            | ✅\*\*        | ✅              |
| View hidden results            | ✅            | ✅            | ❌            | ✅              |
| Delete own account             | ✅            | ✅            | ✅            | ✅              |

_\* Only if `isVotingEligible` is true and hasn't already voted_
_\*\* Only after results are published AND votes are not hidden_

### 4.2 Permission Rules Summary

- **Authentication:** All queries/mutations require authentication (Auth0 JWT) unless explicitly allowed
- **Meeting access:** Users can only access meetings they are participants of
- **Votation access:** Users can only access votations of meetings they participate in
- **Voting eligibility:** Requires `isVotingEligible = true`, votation status `OPEN`, and no prior vote on that votation
- **Self-registration:** Only available if the meeting has `allowSelfRegistration = true`
- **Owner protection:** The meeting owner cannot be removed as a participant
- **Subscriptions:** All subscriptions are publicly allowed (no auth check on subscribe)

---

## 5. Feature Specifications

### 5.1 Authentication & User Management

#### F-AUTH-01: User Registration & Login

- Users authenticate via Auth0 (OAuth2/OIDC)
- On first login, the backend automatically creates a local user record by fetching the Auth0 profile
- If the user's email matches any existing Invites, those invites are automatically converted to Participant records

#### F-AUTH-02: Password Management

- Users can request a password change ticket via Auth0's Management API
- The ticket redirects the user to Auth0's password change flow

#### F-AUTH-03: Account Deletion

- Users can delete their own account
- Deletion triggers Auth0 account removal
- All open votations where the user is a participant are **invalidated** (to prevent incorrect results)
- A real-time notification is sent to all subscribers of the affected votations

---

### 5.2 Meeting Management

#### F-MEET-01: Create Meeting

- **Fields:** title, organization, start time, description (optional), allow self-registration
- The creator is automatically added as an ADMIN participant with voting eligibility
- The creator becomes the **owner** (special role — only person who can delete the meeting)

#### F-MEET-02: Edit Meeting

- Admins can update: title, organization, start time, description, status, allow self-registration
- Status can be changed to ONGOING or ENDED

#### F-MEET-03: Delete Meeting

- Only the meeting **owner** can delete the meeting
- Cascading deletion removes all related data (votations, participants, votes, results, etc.)

#### F-MEET-04: View My Meetings

- Users see all meetings they participate in
- Meetings are categorized as: **Ongoing**, **Upcoming**, or **Ended**
- Ongoing = started and not yet past next day 6:00 AM
- Each meeting card shows: title, start time, status tag, admin badge

#### F-MEET-05: Meeting Lobby

- The main runtime view for a live meeting
- **For Admins:** Top navigation bar with tabs for Self-registration, Votation List, Active Votation
- **For Participants:** View votation list and active votation
- **Presentation Mode:** Admin toggle to hide admin controls for screen projection
- Real-time subscription: auto-navigates all users when a votation is opened

---

### 5.3 Participant Management

#### F-PART-01: Invite Participants by Email

- Admins can add participants by email address
- For each email:
    - If user exists → creates Participant record immediately
    - If user does not exist → creates Invite record (converted on signup)
- Each participant is assigned: role (ADMIN/COUNTER/PARTICIPANT) and voting eligibility

#### F-PART-02: Invite Participants via CSV Upload

- Admins can upload a CSV file with columns: email, role
- Invalid lines are reported with line numbers
- Duplicate emails (already invited) are skipped

#### F-PART-03: Email Notifications

- When participants are added, an email is sent via SMTP
- Email contains: meeting title, start time, role, and registration link
- Different content for registered vs unregistered users

#### F-PART-04: Self-Registration

- Meetings can enable self-registration
- A QR code and shareable link are generated for the meeting
- Authenticated users visiting the link are auto-registered as PARTICIPANT
- The QR code can be displayed in the meeting lobby (for projection)

#### F-PART-05: Manage Participants

- Admins can:
    - Search/filter participants by email
    - Sort participants alphabetically (A-Å / Å-A)
    - Change participant roles (Admin, Counter, Participant)
    - Toggle voting eligibility
    - Bulk select and delete participants
- The meeting owner cannot be removed or have their role changed
- Role changes are broadcast in real-time via subscriptions

#### F-PART-06: Participant Role Updates (Real-time)

- When an admin changes a participant's role or eligibility, the affected user receives a real-time update
- The UI reflects the change immediately (e.g., admin controls appear/disappear)

---

### 5.4 Votation (Ballot) Management

#### F-VOTE-01: Create Votations

- Admins can create one or more votations for a meeting
- **Fields per votation:**
    - Title (required, max 255 chars)
    - Description (optional)
    - Type: Simple / Qualified 50% / Qualified 67% / STV
    - Alternatives (voting options, max 120 chars each)
    - Allow blank votes (checkbox, hidden for STV)
    - Hidden vote results (checkbox — restricts result visibility)
    - Number of winners (for STV only, default 1)
- Votations are ordered by index (drag-and-drop reordering supported)
- Batch creation and update supported

#### F-VOTE-02: Edit Votations

- Admins can edit votations **only while they have UPCOMING status**
- Editable fields: all creation fields plus alternatives (add/update/delete)
- Drag-and-drop reordering of votations
- Duplicate votation functionality (copies all fields and alternatives)
- Changes are broadcast in real-time to all meeting participants

#### F-VOTE-03: Delete Votations

- Admins can delete votations
- Deletion is broadcast in real-time

#### F-VOTE-04: Votation List View

- All participants see the votation list organized by status:
    - **Active votation** (currently open, highlighted green)
    - **Next votation** (next in queue)
    - **Upcoming votations** (remaining in queue)
    - **Ended votations** (published or invalidated, showing winners)
- Admin mode: full CRUD with drag-and-drop
- Lobby mode: read-only with click-to-view

---

### 5.5 Voting Process

#### F-VOTING-01: Start Votation

- Admins can start the next votation in queue via "Start neste votering"
- **Constraints:**
    - Only one votation can be OPEN at a time (enforced by backend)
    - Votation must have at least one alternative
    - Returns union type: `OpenedVotation | MaxOneOpenVotationError | NoUpcomingVotations | VotationHasNoAlternatives`
- All meeting participants receive a real-time notification with the opened votation ID

#### F-VOTING-02: Cast Vote (Simple/Qualified)

- Participants select exactly one alternative from a list
- Alternatives are **randomly shuffled** on the frontend to prevent ordering bias
- Option to cast a **blank vote** if enabled
- After voting, participants see a confirmation and live vote count
- **Ballot secrecy:** The system records WHO voted (HasVoted) but does NOT link the user to their specific vote

#### F-VOTING-03: Cast Vote (STV / Ranked Preference)

- Participants rank alternatives by preference using drag-and-drop
- Not all alternatives need to be ranked
- Rankings are submitted as an array of (alternativeId, ranking) pairs
- Same ballot secrecy guarantees as regular voting

#### F-VOTING-04: Live Vote Count

- All participants see real-time vote count: `X / Y` (votes cast / eligible voters)
- Updated via GraphQL subscription on each new vote

#### F-VOTING-05: Close Votation & Check Results

- Admin transitions votation from `OPEN` → `CHECKING_RESULT`
- System automatically computes results:
    - **Simple:** Alternative with most votes wins
    - **Qualified:** Alternative exceeding the threshold % of eligible voters wins
    - **STV:** Multi-round elimination using Droop quota (detailed STV algorithm)
- A `VotationResult` snapshot is created with eligible count, vote count, blank count, quota

#### F-VOTING-06: Result Review

- During `CHECKING_RESULT` status:
    - Admins and Counters see the computed results
    - They can **approve** or **disapprove** the result
    - Review counts (approved / disapproved) are shown in real-time
    - Each reviewer can change their review
- Review results help administrators decide whether to publish or invalidate

#### F-VOTING-07: Publish Results

- Admin transitions votation from `CHECKING_RESULT` → `PUBLISHED_RESULT`
- All participants see the results:
    - Winner announcement with visual celebration
    - Results table showing: alternative, votes, % of total, % of eligible
    - STV: Additional round-by-round breakdown
- Results can be downloaded as CSV

#### F-VOTING-08: Invalidate Votation

- Admin can invalidate from `OPEN` or `CHECKING_RESULT` status
- Status changes to `INVALID` with a reason message
- All participants are notified in real-time
- Automatic invalidation occurs if a participant deletes their account during an open votation

#### F-VOTING-09: View Historical Results

- Participants can view results of published votations from the votation list
- Results modal shows: winners, vote breakdown, STV round details
- Hidden votes restriction: regular participants cannot see detailed results if `hiddenVotes` is true

---

### 5.6 STV (Single Transferable Vote) Algorithm

The STV implementation uses the **Droop quota** method:

1. **Quota calculation:** `quota = floor(totalVotes / (numberOfWinners + 1)) + 1`
2. **Round processing:**
    - Count first-preference votes for all remaining alternatives
    - Alternatives exceeding the quota → declared **winners**
    - Winner's surplus votes are redistributed with reduced weight: `weight = surplus / totalVotesForWinner`
    - If no winner in a round, the alternative with the **fewest votes** is eliminated as a **loser**
    - Loser's votes are redistributed at full weight to next preference
3. **Tie-breaking:** If multiple alternatives tie for fewest votes and eliminating all would leave too few candidates, some are randomly kept
4. **Termination:** When enough winners found, or remaining alternatives ≤ seats left
5. **Storage:** Each round's results are stored (winners, losers, vote counts per alternative per round)

---

### 5.7 Real-time Features (Subscriptions)

| Subscription               | Trigger                   | Payload                                 |
| -------------------------- | ------------------------- | --------------------------------------- |
| `votationOpenedForMeeting` | Votation opened           | Votation ID                             |
| `votationStatusUpdated`    | Status changes            | Votation ID, new status, reason         |
| `newVoteRegistered`        | Vote cast                 | Votation ID, vote count, eligible count |
| `reviewAdded`              | Result review submitted   | Approved count, disapproved count       |
| `votationsUpdated`         | Votations created/updated | Full votation list with alternatives    |
| `votationDeleted`          | Votation deleted          | Votation ID                             |
| `participantUpdated`       | Role/eligibility changed  | New role, new eligibility               |

---

### 5.8 Frontend Features

#### F-UI-01: Responsive Design

- Fully responsive layout (desktop + mobile)
- Mobile hamburger navigation menu
- Touch-device detection for accordion-style votation display

#### F-UI-02: Presentation Mode

- Admin toggle to hide administrative controls
- Intended for projecting the meeting view on a screen
- Only affects the current admin's view

#### F-UI-03: CSV Export

- Results can be downloaded as CSV files
- Regular votations: alternative, votes, winner status
- STV votations: per-round vote counts, winners, losers

#### F-UI-04: Meeting Creation Wizard

- 3-step wizard:
    1. Meeting details (title, organization, start time, description)
    2. Votations (create/edit votation list)
    3. Participants (invite by email/CSV, configure roles)
- Step indicator with navigation
- Unsaved changes warning when navigating between steps

---

## 6. Non-Functional Requirements

### 6.1 Security

- All API access requires JWT authentication (Auth0)
- Authorization enforced via `graphql-shield` middleware
- Ballot secrecy: vote-to-voter mapping is not stored (HasVoted is separate from Vote)
- Owner protection: meeting owner cannot be removed as participant
- CORS configured to allow only the frontend domain

### 6.2 Performance

- Real-time updates via WebSocket (Redis PubSub)
- Optimistic UI updates where appropriate
- Apollo Client caching

### 6.3 Reliability

- Automatic votation invalidation if a participant account is deleted during an open vote
- Transaction-based vote casting (atomic: HasVoted + Vote creation)
- Reconnection strategy for Redis PubSub (2-second retry)

### 6.4 Internationalization

- Current language: **Norwegian (Bokmål)** only
- All user-facing strings are in Norwegian
- Date formatting uses Norwegian locale (`nb`)

### 6.5 Infrastructure

- Docker Compose deployment
- PostgreSQL database
- Redis for real-time pub/sub
- SMTP server for email delivery

---

## 7. Integration Points

| System      | Purpose                   | Protocol                       |
| ----------- | ------------------------- | ------------------------------ |
| Auth0       | Authentication & identity | OAuth2 / OIDC / Management API |
| PostgreSQL  | Primary data store        | Prisma ORM                     |
| Redis       | Real-time pub/sub         | ioredis                        |
| SMTP Server | Email notifications       | SMTP (nodemailer)              |

---

## 8. Environment Variables

| Variable                        | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `DB_URL`                        | PostgreSQL connection string             |
| `AUTH0_DOMAIN`                  | Auth0 tenant domain                      |
| `AUTH0_AUDIENCE`                | Auth0 API audience identifier            |
| `AUTH0_CLIENT_ID` / `CLIENT_ID` | Auth0 application client ID              |
| `CLIENT_SECRET`                 | Auth0 management API secret              |
| `AUTH0_CALLBACK_URL`            | Post-authentication redirect URL         |
| `FRONTEND_URL`                  | Frontend base URL                        |
| `REDIS_HOST`                    | Redis server hostname                    |
| `REDIS_PASSWORD`                | Redis authentication                     |
| `SMTP_HOST`                     | SMTP server hostname                     |
| `SMTP_PORT`                     | SMTP server port                         |
| `EMAIL_USER`                    | SMTP authentication username             |
| `EMAIL_PASSWORD`                | SMTP authentication password             |
| `PORT`                          | Backend server port (default: 4000)      |
| `MOCKING`                       | Enable mock data (`true`/`false`)        |
| `NODE_ENV`                      | Environment (`development`/`production`) |
