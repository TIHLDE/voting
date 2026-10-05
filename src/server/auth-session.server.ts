import { getRequest } from '@tanstack/react-start/server';
import { auth } from '#/lib/auth';

export async function getServerSession() {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    return session;
}

export async function requireAuth() {
    const session = await getServerSession();
    if (!session) {
        throw new Error('Du er ikke logget inn. Logg inn og prøv igjen.');
    }
    return session;
}
