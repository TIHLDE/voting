import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { auth } from '#/lib/auth';
import { requireAuth } from './auth-session.server';

export const getMyLoginMethods = createServerFn({ method: 'GET' }).handler(
    async () => {
        await requireAuth();

        const accounts = await auth.api.listUserAccounts({
            headers: getRequest().headers,
        });

        return {
            accounts,
            hasPassword: accounts.some((a) => a.providerId === 'credential'),
            hasTihlde: accounts.some((a) => a.providerId === 'photon'),
        };
    },
);
