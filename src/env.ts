import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
    server: {
        DATABASE_URL: z.string().url(),
        BETTER_AUTH_SECRET: z.string().min(1),
        BETTER_AUTH_URL: z.string().url().optional(),
    },

    clientPrefix: 'VITE_',

    client: {
        VITE_APP_TITLE: z.string().min(1).optional(),
    },

    runtimeEnv: import.meta.env,
    emptyStringAsUndefined: true,
});
