import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getVotationResults } from '#/server/results.ts';
import { updateVotationStatus, resetVotation } from '#/server/voting.ts';
import { Button } from '#/components/ui/button';

interface CheckResultsProps {
    votationId: string;
    meetingId: string;
    isAdmin: boolean;
}

export default function CheckResults({
    votationId,
    meetingId,
    isAdmin,
}: CheckResultsProps) {
    const queryClient = useQueryClient();

    const { data: results } = useQuery({
        queryKey: ['results', votationId],
        queryFn: () => getVotationResults({ data: { votationId } }),
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
