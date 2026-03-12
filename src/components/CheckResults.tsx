import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getVotationResults } from '#/server/results.ts';
import {
    updateVotationStatus,
    resetVotation,
    reviewVotation,
    getReviewCounts,
    getMyReview,
    getReviewerCount,
} from '#/server/voting.ts';
import { Button } from '#/components/ui/button';
import { useWsSubscription } from '#/hooks/useWsSubscription';
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

    const { data: results } = useQuery({
        queryKey: ['results', votationId],
        queryFn: () => getVotationResults({ data: { votationId } }),
    });

    const { data: reviewCounts } = useQuery({
        queryKey: ['reviewCounts', votationId],
        queryFn: () => getReviewCounts({ data: { votationId } }),
        enabled: isAdminOrCounter,
    });

    const { data: reviewerCount } = useQuery({
        queryKey: ['reviewerCount', meetingId],
        queryFn: () => getReviewerCount({ data: { meetingId } }),
        enabled: isAdminOrCounter,
    });

    const { data: myReview } = useQuery({
        queryKey: ['myReview', votationId],
        queryFn: () => getMyReview({ data: { votationId } }),
        enabled: isAdminOrCounter,
    });

    useWsSubscription(
        isAdminOrCounter ? `votation:${votationId}:reviews` : '',
        {
            setQueryData: ['reviewCounts', votationId],
        },
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
    const totalVotes = alternatives.reduce((sum, a) => sum + a.voteCount, 0);

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

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="p-2 text-left font-semibold">
                                Alternativ
                            </th>
                            <th className="p-2 text-right font-semibold">
                                {isSTV ? 'Førstevalg' : 'Stemmer'}
                            </th>
                            <th className="p-2 text-right font-semibold">
                                % av totalt
                            </th>
                            <th className="p-2 text-right font-semibold">
                                % av stemmeberettigede
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {alternatives.map((alt) => (
                            <tr
                                key={alt.id}
                                className={`border-b ${alt.isWinner ? 'font-semibold text-green-700 dark:text-green-400' : ''}`}
                            >
                                <td className="p-2">{alt.text}</td>
                                <td className="p-2 text-right">
                                    {alt.voteCount}
                                </td>
                                <td className="p-2 text-right">
                                    {totalVotes > 0
                                        ? (
                                              (alt.voteCount / totalVotes) *
                                              100
                                          ).toFixed(1)
                                        : '0.0'}
                                    %
                                </td>
                                <td className="p-2 text-right">
                                    {result && result.votingEligibleCount > 0
                                        ? (
                                              (alt.voteCount /
                                                  result.votingEligibleCount) *
                                              100
                                          ).toFixed(1)
                                        : '0.0'}
                                    %
                                </td>
                            </tr>
                        ))}
                        {result?.blankVoteCount != null &&
                            result.blankVoteCount > 0 && (
                                <tr className="border-b italic">
                                    <td className="p-2">Blanke stemmer</td>
                                    <td className="p-2 text-right">
                                        {result.blankVoteCount}
                                    </td>
                                    <td
                                        className="p-2 text-right"
                                        colSpan={2}
                                    />
                                </tr>
                            )}
                    </tbody>
                </table>
            </div>

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
