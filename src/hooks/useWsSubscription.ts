import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from './useSSE';

export function useWsSubscription(
    channel: string,
    options: {
        invalidate?: readonly (readonly unknown[])[];
        setQueryData?: readonly unknown[];
        onMessage?: (data: unknown) => void;
    },
) {
    const queryClient = useQueryClient();

    useSSE(channel, (data) => {
        if (options.invalidate) {
            for (const key of options.invalidate) {
                void queryClient.invalidateQueries({
                    queryKey: key as unknown[],
                });
            }
        }
        if (options.setQueryData) {
            queryClient.setQueryData(options.setQueryData as unknown[], data);
        }
        options.onMessage?.(data);
    });
}
