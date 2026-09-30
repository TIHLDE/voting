import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { authClient } from '#/lib/auth-client';

export function useSignOut() {
    const router = useRouter();
    const queryClient = useQueryClient();

    return async () => {
        await authClient.signOut();
        await router.navigate({ to: '/' });
        // Drop everything cached for the signed-out user.
        queryClient.clear();
        await router.invalidate();
    };
}
