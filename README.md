# Vedtatt

A real-time democratic voting platform for organizations. Conduct formal voting sessions with support for simple majority, qualified majority, and Single Transferable Vote (STV) methods.

## Features

- **Real-time voting sessions** with live result tabulation via Server-Sent Events
- **Multiple voting methods**: Simple majority, qualified majority, and STV
- **Meeting management**: Create meetings, define votations, invite participants
- **Role-based access**: Admin, Counter, and Participant roles with granular permissions
- **Secret ballot**: Tracks who voted but not how they voted
- **QR-based registration**: Easy participant onboarding via QR codes or shared links
- **Result review workflow**: Counters approve results before publishing

## Tech Stack

- **Runtime / Package Manager / Test Runner**: [Bun](https://bun.sh)
- **Framework**: [TanStack Start](https://tanstack.com/start) (React 19, Vite, Nitro)
- **Database**: PostgreSQL 17 with [Drizzle ORM](https://orm.drizzle.team)
- **Auth**: [Better Auth](https://www.better-auth.com) (email/password)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- **Linting / Formatting**: [oxlint](https://oxc.rs) + [oxfmt](https://oxc.rs)

## Prerequisites

- [Bun](https://bun.sh) 1.x
- [Docker](https://www.docker.com) (for local PostgreSQL)

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Start the database

```bash
bun run db:up
```

This starts a PostgreSQL 17 container via Docker Compose (user: `vedtatt`, password: `vedtatt`, database: `vedtatt`, port: `5432`).

### 3. Configure environment variables

Create a `.env.local` file:

```bash
DATABASE_URL="postgresql://vedtatt:vedtatt@localhost:5432/vedtatt"
BETTER_AUTH_SECRET="<your-secret>"
```

Generate the auth secret:

```bash
bunx @better-auth/cli secret
```

Or

```bash
openssl rand -hex 32
```

### 4. Run database migrations

```bash
bun run db:generate
bun run db:migrate
```

### 5. (Optional) Seed the database

```bash
bun run db:seed
```

This adds 2 users:

- Admin: `a@a.com` with password `12345678`
- Participant: `b@b.com` with password `12345678`

It also creates a meeting with everyone added to it in their respective roles.

This meeting has all the different voting methods already set up.

### 6. Start the dev server

```bash
bun run dev
```

The app will be available at `http://localhost:3000`.

## Scripts

| Script                 | Description                             |
| ---------------------- | --------------------------------------- |
| `bun run dev`          | Start development server                |
| `bun run build`        | Build for production                    |
| `bun run preview`      | Preview production build                |
| `bun run test`         | Run tests (Vitest)                      |
| `bun run lint`         | Lint with oxlint                        |
| `bun run lint:fix`     | Auto-fix lint issues                    |
| `bun run format`       | Format code with oxfmt                  |
| `bun run format:check` | Check formatting                        |
| `bun run db:up`        | Start PostgreSQL container              |
| `bun run db:down`      | Stop PostgreSQL container               |
| `bun run db:generate`  | Generate Drizzle migrations from schema |
| `bun run db:migrate`   | Apply migrations                        |
| `bun run db:push`      | Push schema changes directly            |
| `bun run db:studio`    | Open Drizzle Studio (visual DB browser) |
| `bun run db:seed`      | Seed database with test data            |

## Project Structure

```
src/
├── components/        # React components (UI, voting, meeting management)
│   └── ui/            # shadcn/ui primitives
├── db/
│   ├── index.ts       # Drizzle ORM instance
│   └── schema.ts      # Database schema & relations
├── routes/            # File-based routing (TanStack Router)
│   ├── _authenticated/ # Protected routes (meetings, profile)
│   └── api/           # API routes (auth, SSE)
├── server/            # Server functions, voting logic, permissions
│   ├── sse/           # Server-Sent Events manager
│   └── stv.ts         # STV algorithm implementation
├── lib/               # Auth config, utilities
└── hooks/             # React hooks (SSE subscriptions)
```
