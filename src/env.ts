import { createEnv } from '@t3-oss/env-core';
import { createIsomorphicFn } from '@tanstack/react-start';
import dotenv from 'dotenv';
import { z } from 'zod';

const getEnv = createIsomorphicFn()
    .client(() => import.meta.env)
    .server(() => {
        dotenv.config();
        return { ...import.meta.env, ...process.env };
    });

export const env = createEnv({
    server: {
        DATABASE_URL: z.string().url(),
        BETTER_AUTH_SECRET: z.string().min(1),
        BETTER_AUTH_URL: z.string().url().optional(),

        PHOTON_CLIENT_ID: z.string().optional(),
        PHOTON_CLIENT_SECRET: z.string().optional(),
        PHOTON_ISSUER: z.string().url().optional(),
        PHOTON_API_URL: z
            .string()
            .url()
            .default('https://photon.tihlde.org/api'),
        PHOTON_EMAIL_API_KEY: z.string().optional(),
    },

    clientPrefix: 'VITE_',

    client: {
        VITE_APP_NAME: z.string().min(1).optional(),
    },

    runtimeEnv: getEnv(),
    emptyStringAsUndefined: true,
});

export const APP_NAME =
    import.meta.env.VITE_APP_NAME ?? env.VITE_APP_NAME ?? 'TIHLDE Voting';
