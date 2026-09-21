import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    updateVotationStatus,
    resetVotation,
    reviewVotation,
} from '#/server/voting';
import { Button } from '#/components/ui/button';
import { useLiveQuerySubscription } from '#/hooks/useLiveQuerySubscription';
import { liveEvents } from '#/lib/live-events';
import {
    myReviewQuery,
    reviewCountsQuery,
    reviewerCountQuery,
    resultsQuery,
} from '#/queries/live';
import { ResultTable } from './ResultTable';
import VoteAudit from './VoteAudit';

interface CheckResultsProps {
    votationId: string;
    meetingId: string;
    isAdmin: boolean;
    isAdminOrCounter: boolean;
}

export default function CheckResults({
    votationId,
    meetingId,
    isAdmin,
    isAdminOrCounter,
}: CheckResultsProps) {
    const queryClient = useQueryClient();

    const { data: results } = useQuery(resultsQuery(votationId));

    const { data: reviewCounts } = useQuery({
        ...reviewCountsQuery(votationId),
        enabled: isAdminOrCounter,
    });

    const { data: reviewerCount } = useQuery({
        ...reviewerCountQuery(meetingId),
        enabled: isAdminOrCounter,
    });

    const { data: myReview } = useQuery({
        ...myReviewQuery(votationId),
        enabled: isAdminOrCounter,
    });

    useLiveQuerySubscription(
        isAdminOrCounter ? liveEvents.votationReviews(votationId) : null,
        { setQueryData: reviewCountsQuery(votationId) },
    );

    const reviewMutation = useMutation({
        mutationFn: (approved: boolean) =>
            reviewVotation({ data: { votationId, approved } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['myReview', votationId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['reviewCounts', votationId],
            });
        },
        onError: (err) => {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke sende vurdering',
            );
        },
    });

    const publishMutation = useMutation({
        mutationFn: () =>
            updateVotationStatus({
                data: { votationId, status: 'PUBLISHED_RESULT' },
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['votation', votationId],
            });
        },
        onError: (err) => {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke publisere resultater',
            );
        },
    });

    const resetMutation = useMutation({
        mutationFn: () => resetVotation({ data: { votationId } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['votation', votationId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['votations', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['activeVotation', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['hasVoted', votationId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['voteCount', votationId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['results', votationId],
            });
        },
        onError: (err) => {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke tilbakestille votering',
            );
        },
    });

    if (!results) {
        return (
            <p className="text-center text-muted-foreground">
                Resultater kontrolleres...
            </p>
        );
    }

    const { result, alternatives, votation } = results;
    const isSTV = votation.type === 'STV';
    const winners = alternatives.filter((a) => a.isWinner);

    return (
        <div className="space-y-6">
            {winners.length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                        Vinner: {winners.map((w) => w.text).join(', ')}
                    </p>
                </div>
            )}

            {winners.length === 0 && (
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">
                        Ingen vinner
                    </p>
                </div>
            )}

            <ResultTable
                alternatives={alternatives}
                result={result}
                isStv={isSTV}
            />

            {isAdminOrCounter && (
                <ReviewSection
                    reviewCounts={reviewCounts}
                    reviewerTotal={reviewerCount?.total ?? 0}
                    myReview={myReview}
                    onReview={(approved) => reviewMutation.mutate(approved)}
                    isPending={reviewMutation.isPending}
                />
            )}

            {isAdminOrCounter && <VoteAudit votationId={votationId} />}

            {isAdmin && (
                <div className="flex gap-2 border-t pt-4">
                    <Button
                        onClick={() => publishMutation.mutate()}
                        disabled={
                            publishMutation.isPending || resetMutation.isPending
                        }
                    >
                        {publishMutation.isPending
                            ? 'Publiserer...'
                            : 'Godkjenn og publiser'}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => resetMutation.mutate()}
                        disabled={
                            publishMutation.isPending || resetMutation.isPending
                        }
                    >
                        {resetMutation.isPending
                            ? 'Tilbakestiller...'
                            : 'Forkast og gjør om'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function ReviewSection({
    reviewCounts,
    reviewerTotal,
    myReview,
    onReview,
    isPending,
}: {
    reviewCounts?: { approved: number; disapproved: number } | null;
    reviewerTotal: number;
    myReview?: { approved: boolean } | null;
    onReview: (approved: boolean) => void;
    isPending: boolean;
}) {
    const approved = reviewCounts?.approved ?? 0;
    const disapproved = reviewCounts?.disapproved ?? 0;

    return (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                    Kontrollstatus
                </h3>
                <div className="flex gap-3 text-sm tabular-nums">
                    <span className="text-green-700 dark:text-green-400">
                        {approved} / {reviewerTotal} godkjent
                    </span>
                    {disapproved > 0 && (
                        <span className="text-destructive">
                            {disapproved} avvist
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {myReview ? (
                    <p className="text-sm text-muted-foreground">
                        Du har {myReview.approved ? 'godkjent' : 'avvist'}{' '}
                        resultatet.
                    </p>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Du har ikke vurdert resultatet ennå.
                    </p>
                )}
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant={
                            myReview?.approved === true ? 'default' : 'outline'
                        }
                        onClick={() => onReview(true)}
                        disabled={isPending}
                    >
                        Godkjenn
                    </Button>
                    <Button
                        size="sm"
                        variant={
                            myReview?.approved === false
                                ? 'destructive'
                                : 'outline'
                        }
                        onClick={() => onReview(false)}
                        disabled={isPending}
                    >
                        Avvis
                    </Button>
                </div>
            </div>
        </div>
    );
}
