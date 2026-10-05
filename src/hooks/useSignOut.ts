import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { authClient } from '#/lib/auth-client';
import { NETWORK_ERROR_MESSAGE } from '#/lib/auth-errors';

export function useSignOut() {
    const router = useRouter();
    const queryClient = useQueryClient();

    return async () => {
        try {
            const { error } = await authClient.signOut();
            if (error) {
                toast.error('Kunne ikke logge ut. Prøv igjen.');
                return;
            }
        } catch {
            toast.error(NETWORK_ERROR_MESSAGE);
            return;
        }
        await router.navigate({ to: '/' });
        // Drop everything cached for the signed-out user.
        queryClient.clear();
        await router.invalidate();
    };
}
