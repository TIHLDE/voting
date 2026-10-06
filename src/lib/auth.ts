import '@tanstack/react-start/server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { genericOAuth } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '#/db/index';
import { env } from '#/env';
import * as schema from '#/db/schema';
import { acceptPendingInvites } from '#/server/participant-changes.server';

// Photon's OIDC issuer, used to discover the login and token endpoints.
const PHOTON_ISSUER = env.PHOTON_ISSUER ?? 'https://photon.tihlde.org/api/auth';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema,
    }),
    emailAndPassword: {
        enabled: true,
    },
    onAPIError: {
        errorURL: '/auth',
    },
    user: {
        deleteUser: {
            enabled: true,
        },
    },
    databaseHooks: {
        session: {
            create: {
                // On every sign-in, not just sign-up, so invites left behind
                // before this hook existed are also picked up.
                after: async (session) => {
                    const [signedIn] = await db
                        .select({ email: schema.user.email })
                        .from(schema.user)
                        .where(eq(schema.user.id, session.userId));
                    if (!signedIn) return;
                    try {
                        await acceptPendingInvites(
                            session.userId,
                            signedIn.email,
                        );
                    } catch (error) {
                        console.error('Failed to accept invites', error);
                    }
                },
            },
        },
    },
    plugins: [
        genericOAuth({
            config:
                env.PHOTON_CLIENT_ID && env.PHOTON_CLIENT_SECRET
                    ? [
                          {
                              providerId: 'photon',
                              discoveryUrl: `${PHOTON_ISSUER}/.well-known/openid-configuration`,
                              clientId: env.PHOTON_CLIENT_ID,
                              clientSecret: env.PHOTON_CLIENT_SECRET,
                              scopes: ['openid', 'profile', 'email'],
                              // Signing out here must not end the user's
                              // Photon session on tihlde.org.
                              disableProviderLogout: true,
                          },
                      ]
                    : [],
        }),
        tanstackStartCookies(),
    ],
});
