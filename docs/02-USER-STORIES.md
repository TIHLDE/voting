# User Stories

## Vedtatt — Democratic Voting Platform

---

## Epic 1: Authentication & Account Management

### US-1.1: User Registration

**As a** new user,
**I want to** sign up using my email address via Auth0,
**So that** I can access the voting platform and participate in meetings.

**Acceptance Criteria:**

- User can click "Logg inn" and be redirected to Auth0 login/signup
- After successful Auth0 authentication, a local user record is created automatically
- User's Auth0 profile (email) is fetched and stored locally
- If the user's email matches any pending Invites, those invites are automatically converted to Participant records for the corresponding meetings
- User is redirected back to the application after login

---

### US-1.2: User Login

**As a** returning user,
**I want to** log in with my existing credentials,
**So that** I can access my meetings and vote.

**Acceptance Criteria:**

- Login button is visible on the navigation bar when not authenticated
- Auth0 handles the authentication flow (email/password or social)
- After login, the user sees their navigation options (Mine møter, Opprett møte, Om oss)
- User's avatar and email appear in the top-right dropdown

---

### US-1.3: User Logout

**As a** logged-in user,
**I want to** log out of the application,
**So that** my session is securely ended.

**Acceptance Criteria:**

- Logout option available in the avatar dropdown menu
- Clicking logout clears the session and redirects to the home page
- Auth0 session is also terminated

---

### US-1.4: Change Password

**As a** user,
**I want to** change my password,
**So that** I can maintain account security.

**Acceptance Criteria:**

- "Endre passord" option available on the profile page
- Clicking it generates an Auth0 password change ticket
- User is redirected to Auth0's password change flow
- After completion, user is redirected back to the application

---

### US-1.5: Delete Account

**As a** user,
**I want to** permanently delete my account and all associated data,
**So that** my personal data is removed from the platform.

**Acceptance Criteria:**

- "Slett bruker" option on the profile page with confirmation dialog
- Confirmation dialog warns about irreversibility
- On confirmation:
    - Auth0 account is deleted
    - Local user record is deleted (cascade)
    - All open votations where the user was a participant are **invalidated**
    - Real-time notification sent to affected votation subscribers with reason
- User is logged out after deletion
- Toast notification confirms deletion

---

## Epic 2: Meeting Management

### US-2.1: Create a Meeting

**As an** authenticated user,
**I want to** create a new meeting,
**So that** I can organize a voting session for my organization.

**Acceptance Criteria:**

- "Opprett møte" link in navigation leads to meeting creation wizard
- Step 1: Enter meeting details:
    - Organization name (required)
    - Meeting title (required)
    - Start time (required, date+time picker in Norwegian locale)
    - Description (optional, auto-resizing textarea)
    - Allow self-registration (toggle)
- Validation: Organization and title must not be empty
- On creation, user is automatically assigned as ADMIN + meeting owner
- Meeting is created with status UPCOMING

---

### US-2.2: Add Votations to a Meeting

**As a** meeting admin,
**I want to** define votations (ballots) for my meeting,
**So that** participants know what they'll be voting on.

**Acceptance Criteria:**

- Step 2 of the creation wizard shows the votation editor
- Can add one or more votations with:
    - Title (required)
    - Description (optional)
    - Voting type: Simple majority / Qualified 50% / Qualified 67% / STV
    - Alternatives (at least one, max 120 chars each)
    - Allow blank votes (checkbox, hidden for STV)
    - Hidden results (checkbox)
    - Number of winners (for STV, minimum 1)
- Can reorder votations via drag-and-drop
- Can duplicate an existing votation
- Can delete votations
- Changes can be saved incrementally
- Unsaved changes warning when navigating away

---

### US-2.3: Invite Participants

**As a** meeting admin,
**I want to** invite participants by email,
**So that** they can join my meeting and vote.

**Acceptance Criteria:**

- Step 3 of the creation wizard shows participant management
- Can add participants one by one: enter email, select role, click "Legg til deltager"
- Enter key submits the form
- For registered users → Participant record created immediately
- For unregistered users → Invite record created (converted on signup)
- Email notification sent to each invitee with meeting details
- Duplicate email addresses are silently skipped

---

### US-2.4: Invite Participants via CSV

**As a** meeting admin,
**I want to** bulk-invite participants by uploading a CSV file,
**So that** I can efficiently add many participants at once.

**Acceptance Criteria:**

- CSV upload button accepts `.csv` files
- Expected format: column 1 = email, column 2 = role (optional, defaults to PARTICIPANT)
- Valid roles: "administrator"/"admin", "teller"/"counter", "deltaker"/"participant"
- Invalid email addresses are reported with line numbers
- Duplicates (already invited) are skipped
- Summary toast shows success/error count

---

### US-2.5: Edit a Meeting

**As a** meeting admin,
**I want to** edit meeting details after creation,
**So that** I can update information as needed.

**Acceptance Criteria:**

- From "Mine møter", clicking the options menu shows "Rediger møte"
- Opens the same 3-step wizard pre-populated with existing data
- Can modify: title, organization, start time, description, self-registration
- Can add/edit/delete votations (only UPCOMING ones)
- Can add/remove participants
- Changes saved on each step

---

### US-2.6: Delete a Meeting

**As the** meeting owner,
**I want to** delete a meeting,
**So that** it is permanently removed.

**Acceptance Criteria:**

- Only the meeting owner (creator) sees the delete option
- Confirmation dialog with meeting title
- On deletion: all related data is cascade-deleted
- User is redirected to "Mine møter"
- Toast notification confirms deletion

---

### US-2.7: View My Meetings

**As a** user,
**I want to** see all meetings I'm participating in,
**So that** I can navigate to the right meeting.

**Acceptance Criteria:**

- "Mine møter" page shows all meetings categorized:
    - **Ongoing** — meetings that have started and are within the active window
    - **Upcoming** — meetings scheduled in the future
    - **Ended** — past meetings
- Each meeting card displays:
    - Title
    - Formatted start time
    - Status tag (Aktiv / time remaining / Avsluttet)
    - "Admin" badge if user is an admin
- Clicking a card navigates to the meeting lobby
- Admin users see options popover (Edit, Delete)

---

## Epic 3: Participant Management

### US-3.1: View Participant List

**As a** meeting admin,
**I want to** view all participants and invites for my meeting,
**So that** I know who is expected and what their roles are.

**Acceptance Criteria:**

- Participant list shows: email, role, voting eligibility
- Distinguishes between registered users and pending invites
- Searchable by email (debounced search)
- Sortable alphabetically (A-Å / Å-A)
- Meeting owner is visually distinguished (cannot be modified)

---

### US-3.2: Change Participant Role

**As a** meeting admin,
**I want to** change a participant's role,
**So that** I can assign the right permissions.

**Acceptance Criteria:**

- Role dropdown next to each participant: Administrator / Teller / Deltaker
- Change takes effect immediately
- Affected participant receives real-time update
- Admin controls appear/disappear based on new role
- Cannot change the meeting owner's role

---

### US-3.3: Toggle Voting Eligibility

**As a** meeting admin,
**I want to** toggle a participant's voting eligibility,
**So that** I can control who can vote.

**Acceptance Criteria:**

- Toggle switch next to each participant
- Change takes effect immediately
- Affected participant receives real-time update
- Ineligible participants cannot cast votes but can still view the meeting

---

### US-3.4: Remove Participants

**As a** meeting admin,
**I want to** remove participants from the meeting,
**So that** only authorized people remain.

**Acceptance Criteria:**

- Checkbox selection for each participant
- Bulk delete button with confirmation dialog showing selected emails
- Meeting owner cannot be selected for removal
- For registered users → Participant record deleted
- For invites → Invite record deleted

---

### US-3.5: Self-Register for a Meeting

**As an** authenticated user,
**I want to** self-register for a meeting using a shared link or QR code,
**So that** I can join a meeting without being individually invited.

**Acceptance Criteria:**

- Only works if meeting has `allowSelfRegistration = true`
- Shareable URL format: `/meeting/{meetingId}/register`
- QR code displayed in the meeting lobby
- If not authenticated → redirect to Auth0 login, then back to registration
- If already a participant → navigate to meeting lobby
- On registration → user added as PARTICIPANT with default voting eligibility
- Confirmation message and redirect to meeting lobby

---

## Epic 4: Live Voting

### US-4.1: Start a Votation

**As a** meeting admin,
**I want to** start the next votation,
**So that** participants can begin voting.

**Acceptance Criteria:**

- "Start neste votering" button in the meeting lobby
- Only one votation can be OPEN at a time
- The next UPCOMING votation (by index order) is opened
- Error handling for:
    - Already an open votation → "Møtet kan kun ha en åpen votering om gangen"
    - No upcoming votations → "Møtet har ingen kommende voteringer"
    - Votation has no alternatives → "Voteringen kan ikke åpnes da den ikke har noen alternativer"
- All participants receive real-time notification and auto-navigate to the active votation

---

### US-4.2: Cast a Simple/Qualified Vote

**As a** voting-eligible participant,
**I want to** select and submit my vote for one alternative,
**So that** my preference is counted.

**Acceptance Criteria:**

- Alternatives displayed in randomly shuffled order (prevent bias)
- Select exactly one alternative by clicking/tapping
- Selected alternative highlighted with green border
- "Avgi stemme" (Cast vote) button enabled only when selection made
- After voting:
    - Confirmation shown
    - Live vote count updated
    - Optional "Vis meg hva jeg stemte" (Show my vote) toggle
- Cannot vote twice on the same votation
- Cannot vote if not eligible

---

### US-4.3: Cast a Blank Vote

**As a** voting-eligible participant,
**I want to** cast a blank vote,
**So that** I participate without choosing an alternative.

**Acceptance Criteria:**

- Blank vote option shown only if votation has `blankVotes = true`
- Blank vote option appears alongside alternatives
- After casting → same confirmation flow as regular vote
- Blank votes are counted separately in results

---

### US-4.4: Cast an STV (Ranked) Vote

**As a** voting-eligible participant,
**I want to** rank alternatives by preference,
**So that** my vote transfers if my top choice is eliminated.

**Acceptance Criteria:**

- Interface shows two sections: "Ranked" and "Unranked"
- Drag-and-drop to move alternatives between sections and reorder
- Arrow buttons (up/down) for keyboard-based reordering
- Not all alternatives need to be ranked
- Each ranked alternative shows its rank number
- On submit, rankings are sent as (alternativeId, ranking) pairs
- Cannot modify vote after submission

---

### US-4.5: View Live Vote Progress

**As a** meeting participant,
**I want to** see how many votes have been cast in real-time,
**So that** I know the voting progress.

**Acceptance Criteria:**

- Vote count displayed as "X / Y stemmer" (X votes of Y eligible)
- Updates in real-time via WebSocket subscription
- Visible during OPEN and CHECKING_RESULT statuses

---

### US-4.6: Close Votation & Review Results

**As a** meeting admin,
**I want to** close voting and review the computed results,
**So that** I can verify correctness before publishing.

**Acceptance Criteria:**

- Admin clicks "Gå videre" to transition from OPEN → CHECKING_RESULT
- Results are computed automatically:
    - Simple: most votes wins
    - Qualified: must exceed threshold % of eligible voters
    - STV: multi-round elimination with Droop quota
- Winners are highlighted in green
- Results table shows: alternative, vote count, % of total, % of eligible
- For STV: additional round-by-round breakdown with quota line
- Blank vote count shown if applicable

---

### US-4.7: Approve/Disapprove Votation Results

**As a** counter or admin,
**I want to** approve or disapprove the computed results,
**So that** we ensure voting integrity.

**Acceptance Criteria:**

- During CHECKING_RESULT status:
    - "Gyldig" (Valid) and "Ugyldig" (Invalid) buttons shown
    - Can toggle between approved and disapproved
    - Real-time counter: "X godkjent, Y ikke godkjent av Z tellere"
- Review visible to all admins and counters
- Regular participants see a waiting/checking results message

---

### US-4.8: Publish Votation Results

**As a** meeting admin,
**I want to** publish the results to all participants,
**So that** everyone can see the outcome.

**Acceptance Criteria:**

- Admin clicks "Publiser resultat" to transition CHECKING_RESULT → PUBLISHED_RESULT
- All participants see:
    - Winner announcement with celebration visual
    - Full results table
    - Download results as CSV button
- If `hiddenVotes = true`, regular participants see only the winner, not the detailed breakdown
- "Start neste votering" button appears for admins

---

### US-4.9: Invalidate a Votation

**As a** meeting admin,
**I want to** invalidate a votation,
**So that** it is marked as cancelled if issues arise.

**Acceptance Criteria:**

- Available during OPEN or CHECKING_RESULT statuses
- Confirmation dialog with warning
- Status transitions to INVALID
- Reason displayed: "Voteringen ble avbrutt av en administrator"
- All participants notified in real-time
- Votation appears as "Avbrutt" in the votation list

---

### US-4.10: View Published Results After the Fact

**As a** meeting participant,
**I want to** view results of completed votations,
**So that** I can review outcomes.

**Acceptance Criteria:**

- Ended votations in the list show winner(s)
- Clicking opens a result modal with full breakdown
- STV votations show round-by-round details
- Hidden votations only show winner, not vote counts

---

## Epic 5: Meeting Lobby Experience

### US-5.1: Join Meeting Lobby

**As a** meeting participant,
**I want to** enter the meeting lobby,
**So that** I can see the meeting progress and participate in votations.

**Acceptance Criteria:**

- Click meeting card → navigate to lobby
- Lobby shows: meeting title, votation list
- If a votation is currently open → auto-navigate to active votation view
- Real-time subscription auto-navigates when admin opens a votation

---

### US-5.2: Admin Lobby Controls

**As a** meeting admin,
**I want to** have administrative controls in the lobby,
**So that** I can manage the meeting flow.

**Acceptance Criteria:**

- Top navigation bar with tabs:
    - Selvregistrering (Self-registration QR code)
    - Voteringsliste (Votation list)
    - Aktiv votering (Active votation)
- Presentation mode toggle (hides admin controls for projection)
- "Administrer deltagere" (Manage participants) modal
- "Start neste votering" button

---

### US-5.3: Presentation Mode

**As a** meeting admin,
**I want to** toggle presentation mode,
**So that** I can project the meeting view without showing admin controls.

**Acceptance Criteria:**

- Toggle in the admin bar
- When enabled: hides admin buttons, review section, and management controls
- Only vote count and results are shown
- Does not affect other users' views

---

### US-5.4: QR Code Self-Registration Display

**As a** meeting admin,
**I want to** display a QR code on the projected screen,
**So that** attendees can scan and self-register.

**Acceptance Criteria:**

- QR code tab in admin navigation
- Large QR code displayed with readable link below
- Copy link button for sharing via other channels
- Only shown if meeting has self-registration enabled

---

## Epic 6: Informational

### US-6.1: About Page

**As a** visitor,
**I want to** learn about the platform and its partner organizations,
**So that** I understand who built and supports it.

**Acceptance Criteria:**

- About page accessible from navigation
- Shows information about partner organizations
- Expandable section explaining voting types:
    - Simpelt flertall (Simple majority)
    - Kvalifisert flertall (Qualified majority)
    - Kvalifisert 2/3 flertall (Qualified 2/3 majority)
    - Preferansevalg / STV
- No authentication required

---

### US-6.2: Front Page

**As a** visitor,
**I want to** see a landing page explaining the platform,
**So that** I understand what the application does.

**Acceptance Criteria:**

- Landing page with hero section
- Tagline: "Gjennomfør effektive og gode demokratiske prosesser"
- Link to feedback form
- Download link for privacy/safety documentation (PDF)
- Partner organization logos
- Login button for unauthenticated users

---

## Epic 7: Data Export

### US-7.1: Download Votation Results as CSV

**As a** meeting participant (or admin),
**I want to** download votation results as a CSV file,
**So that** I can archive or process the data externally.

**Acceptance Criteria:**

- Download button on published results view
- Regular votation CSV: alternative name, vote count, is winner
- STV votation CSV: per-round data with vote redistribution
- File named descriptively (e.g., meeting title + votation title)
