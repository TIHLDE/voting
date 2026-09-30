import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey, QueryKeyWithDataTag } from '@tanstack/react-query';
import type { z } from 'zod';
import type { LiveEvent } from '#/lib/live-events';
import { useSSE } from './useSSE';

type QueryReference = { queryKey: QueryKey };

export function useLiveQuerySubscription<TSchema extends z.ZodType>(
    event: LiveEvent<TSchema> | null,
    options: {
        invalidate?: readonly QueryReference[];
        setQueryData?: QueryKeyWithDataTag<QueryKey, z.output<TSchema>>;
        onMessage?: (data: z.output<TSchema>) => void;
    },
) {
    const queryClient = useQueryClient();

    const invalidate = () => {
        for (const query of options.invalidate ?? []) {
            void queryClient.invalidateQueries({ queryKey: query.queryKey });
        }
    };

    useSSE(
        event,
        (data) => {
            invalidate();
            if (options.setQueryData) {
                queryClient.setQueryData(options.setQueryData.queryKey, data);
            }
            options.onMessage?.(data);
        },
        invalidate,
    );
}
