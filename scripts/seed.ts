import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool, { schema });

const auth = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: { enabled: true },
});

async function seed() {
    console.log('Cleaning existing seed data...');
    // Clean up in reverse dependency order
    for (const email of ['a@a.com', 'b@b.com']) {
        const existing = await db.query.user.findFirst({
            where: eq(schema.user.email, email),
        });
        if (existing) {
            await db.delete(schema.user).where(eq(schema.user.id, existing.id));
        }
    }

    console.log('Creating users...');
    const resA = await auth.api.signUpEmail({
        body: { email: 'a@a.com', password: '12345678', name: 'Admin A' },
    });
    const resB = await auth.api.signUpEmail({
        body: { email: 'b@b.com', password: '12345678', name: 'Deltaker B' },
    });

    const userA = resA.user;
    const userB = resB.user;
    console.log(`  User A: ${userA.id} (${userA.email})`);
    console.log(`  User B: ${userB.id} (${userB.email})`);

    console.log('Creating meeting...');
    const [meeting] = await db
        .insert(schema.meeting)
        .values({
            title: 'Generalforsamling 2026',
            organization: 'Testorganisasjonen',
            description:
                'Testmøte med alle typer voteringer for å verifisere systemet.',
            startTime: new Date(),
            status: 'UPCOMING',
            allowSelfRegistration: true,
            ownerId: userA.id,
        })
        .returning();
    console.log(`  Meeting: ${meeting.id}`);

    console.log('Adding participants...');
    await db.insert(schema.participant).values([
        {
            role: 'ADMIN',
            isVotingEligible: true,
            isApproved: true,
            userId: userA.id,
            meetingId: meeting.id,
        },
        {
            role: 'PARTICIPANT',
            isVotingEligible: true,
            isApproved: true,
            userId: userB.id,
            meetingId: meeting.id,
        },
    ]);

    console.log('Creating votations...');

    // 1. Simple majority
    const [v1] = await db
        .insert(schema.votation)
        .values({
            title: 'Valg av møteleder',
            description: 'Simpelt flertall - den med flest stemmer vinner.',
            type: 'SIMPLE',
            blankVotes: false,
            hiddenVotes: false,
            numberOfWinners: 1,
            majorityThreshold: 50,
            index: 0,
            meetingId: meeting.id,
        })
        .returning();
    await db.insert(schema.alternative).values([
        { text: 'Ola Nordmann', index: 0, votationId: v1.id },
        { text: 'Kari Nordmann', index: 1, votationId: v1.id },
        { text: 'Per Hansen', index: 2, votationId: v1.id },
    ]);

    // 2. Simple majority with blank votes
    const [v2] = await db
        .insert(schema.votation)
        .values({
            title: 'Godkjenning av årsrapport',
            description: 'Simpelt flertall med blanke stemmer tillatt.',
            type: 'SIMPLE',
            blankVotes: true,
            hiddenVotes: false,
            numberOfWinners: 1,
            majorityThreshold: 50,
            index: 1,
            meetingId: meeting.id,
        })
        .returning();
    await db.insert(schema.alternative).values([
        { text: 'Godkjenn', index: 0, votationId: v2.id },
        { text: 'Avvis', index: 1, votationId: v2.id },
    ]);

    // 3. Qualified majority (50%)
    const [v3] = await db
        .insert(schema.votation)
        .values({
            title: 'Vedtektsendring §5',
            description:
                'Kvalifisert flertall (50%) - alternativ må ha over 50% av stemmeberettigede.',
            type: 'QUALIFIED',
            blankVotes: false,
            hiddenVotes: false,
            numberOfWinners: 1,
            majorityThreshold: 50,
            index: 2,
            meetingId: meeting.id,
        })
        .returning();
    await db.insert(schema.alternative).values([
        { text: 'For endring', index: 0, votationId: v3.id },
        { text: 'Mot endring', index: 1, votationId: v3.id },
    ]);

    // 4. Qualified majority (67%)
    const [v4] = await db
        .insert(schema.votation)
        .values({
            title: 'Oppløsning av forening',
            description:
                'Kvalifisert flertall (67%) - krever 2/3 flertall av stemmeberettigede.',
            type: 'QUALIFIED',
            blankVotes: true,
            hiddenVotes: false,
            numberOfWinners: 1,
            majorityThreshold: 67,
            index: 3,
            meetingId: meeting.id,
        })
        .returning();
    await db.insert(schema.alternative).values([
        { text: 'For oppløsning', index: 0, votationId: v4.id },
        { text: 'Mot oppløsning', index: 1, votationId: v4.id },
    ]);

    // 5. STV - 1 winner
    const [v5] = await db
        .insert(schema.votation)
        .values({
            title: 'Valg av leder',
            description:
                'Preferansevalg (STV) - ranger kandidatene etter preferanse. Droop-kvote.',
            type: 'STV',
            blankVotes: false,
            hiddenVotes: false,
            numberOfWinners: 1,
            majorityThreshold: 50,
            index: 4,
            meetingId: meeting.id,
        })
        .returning();
    await db.insert(schema.alternative).values([
        { text: 'Anna Berg', index: 0, votationId: v5.id },
        { text: 'Erik Solheim', index: 1, votationId: v5.id },
        { text: 'Maria Johansen', index: 2, votationId: v5.id },
        { text: 'Jonas Lie', index: 3, votationId: v5.id },
    ]);

    // 6. STV - 2 winners
    const [v6] = await db
        .insert(schema.votation)
        .values({
            title: 'Valg av styremedlemmer',
            description:
                'Preferansevalg (STV) med 2 vinnere - velg to styremedlemmer.',
            type: 'STV',
            blankVotes: false,
            hiddenVotes: false,
            numberOfWinners: 2,
            majorityThreshold: 50,
            index: 5,
            meetingId: meeting.id,
        })
        .returning();
    await db.insert(schema.alternative).values([
        { text: 'Ingrid Dahl', index: 0, votationId: v6.id },
        { text: 'Thomas Vik', index: 1, votationId: v6.id },
        { text: 'Sofie Lund', index: 2, votationId: v6.id },
        { text: 'Anders Moe', index: 3, votationId: v6.id },
        { text: 'Hilde Strand', index: 4, votationId: v6.id },
    ]);

    // 7. Hidden votes (simple)
    const [v7] = await db
        .insert(schema.votation)
        .values({
            title: 'Mistillitsforslag',
            description:
                'Hemmelig avstemning - resultater er kun synlige for tellere og admin inntil publisering.',
            type: 'SIMPLE',
            blankVotes: true,
            hiddenVotes: true,
            numberOfWinners: 1,
            majorityThreshold: 50,
            index: 6,
            meetingId: meeting.id,
        })
        .returning();
    await db.insert(schema.alternative).values([
        { text: 'For mistillit', index: 0, votationId: v7.id },
        { text: 'Mot mistillit', index: 1, votationId: v7.id },
    ]);

    console.log('\nSeed complete!');
    console.log(`  7 votations created for meeting "${meeting.title}"`);
    console.log(`\n  Login as admin:    a@a.com / 12345678`);
    console.log(`  Login as voter:    b@b.com / 12345678`);
    console.log(
        `  Meeting URL:       http://localhost:3000/meetings/${meeting.id}`,
    );

    process.exit(0);
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
