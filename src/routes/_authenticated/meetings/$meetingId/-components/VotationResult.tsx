import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getVotationResults } from '#/server/results';
import { startNextVotation } from '#/server/voting';
import { Button } from '#/components/ui/button';
import { ResultTable } from './ResultTable';
import VoteAudit from './VoteAudit';

interface VotationResultProps {
    votationId: string;
    meetingId: string;
    isAdmin: boolean;
    isAdminOrCounter: boolean;
}

export default function VotationResultView({
    votationId,
    meetingId,
    isAdmin,
    isAdminOrCounter,
}: VotationResultProps) {
    const queryClient = useQueryClient();

    const { data: results } = useQuery({
        queryKey: ['results', votationId],
        queryFn: () => getVotationResults({ data: { votationId } }),
    });

    const startNextMutation = useMutation({
        mutationFn: () => startNextVotation({ data: { meetingId } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['activeVotation', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['votations', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['meeting', meetingId],
            });
        },
        onError: (err) => {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke starte neste votering',
            );
        },
    });

    if (!results) return null;

    return (
        <VotationResultContent
            results={results}
            votationId={votationId}
            isAdmin={isAdmin}
            isAdminOrCounter={isAdminOrCounter}
            startingNext={startNextMutation.isPending}
            onStartNext={() => startNextMutation.mutate()}
        />
    );
}

type VotationResults = Awaited<ReturnType<typeof getVotationResults>>;

function VotationResultContent({
    results,
    votationId,
    isAdmin,
    isAdminOrCounter,
    startingNext,
    onStartNext,
}: {
    results: VotationResults;
    votationId: string;
    isAdmin: boolean;
    isAdminOrCounter: boolean;
    startingNext: boolean;
    onStartNext: () => void;
}) {
    const { alternatives, votation } = results;
    const winners = alternatives.filter((alternative) => alternative.isWinner);
    const hideDetails = votation.hiddenVotes && !isAdmin;

    return (
        <div className="space-y-6">
            <WinnerSummary winners={winners} />
            {hideDetails ? (
                <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        Detaljerte resultater er skjult for denne voteringen.
                    </p>
                </div>
            ) : (
                <ResultDetails results={results} isAdmin={isAdmin} />
            )}
            {isAdminOrCounter && <VoteAudit votationId={votationId} />}
            {isAdmin && (
                <div className="border-t pt-4">
                    <Button onClick={onStartNext} disabled={startingNext}>
                        {startingNext ? 'Starter...' : 'Start neste votering'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function WinnerSummary({
    winners,
}: {
    winners: VotationResults['alternatives'];
}) {
    if (winners.length === 0) {
        return (
            <div className="rounded-xl border bg-card p-6 text-center">
                <p className="text-lg font-semibold text-foreground">
                    Ingen vinner
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border-2 border-green-600 bg-green-50 p-6 text-center dark:border-green-400 dark:bg-green-950">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-green-700 dark:text-green-400">
                {winners.length > 1 ? 'Vinnere' : 'Vinner'}
            </p>
            <p className="text-2xl font-bold text-foreground">
                {winners.map((winner) => winner.text).join(', ')}
            </p>
        </div>
    );
}

function ResultDetails({
    results,
    isAdmin,
}: {
    results: VotationResults;
    isAdmin: boolean;
}) {
    const { result, alternatives, votation } = results;

    return (
        <>
            <ResultTable
                alternatives={alternatives}
                result={result}
                isStv={votation.type === 'STV'}
            />
            {result && (
                <div className="text-sm text-muted-foreground">
                    <p>
                        Totalt {result.voteCount} av{' '}
                        {result.votingEligibleCount} stemmeberettigede stemte.
                    </p>
                    {result.quota && (
                        <p>STV-kvote (Droop): {result.quota.toFixed(2)}</p>
                    )}
                </div>
            )}
            {votation.type === 'STV' &&
                result?.stvRoundResults &&
                result.stvRoundResults.length > 0 && (
                    <StvRoundTable
                        rounds={result.stvRoundResults}
                        alternatives={alternatives}
                        quota={result.quota ?? 0}
                    />
                )}
            {isAdmin && (
                <div className="flex gap-2">
                    <DownloadResultButton
                        alternatives={alternatives}
                        result={result}
                    />
                </div>
            )}
        </>
    );
}

function StvRoundTable({
    rounds,
    alternatives,
    quota,
}: {
    rounds: Array<{
        index: number;
        alternativeVoteCounts: Array<{
            alternativeId: string;
            voteCount: number;
        }>;
    }>;
    alternatives: Array<{ id: string; text: string; isWinner: boolean }>;
    quota: number;
}) {
    return (
        <div>
            <h3 className="mb-3 text-lg font-semibold text-foreground">
                STV-runder
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="p-2 text-left font-semibold">
                                Alternativ
                            </th>
                            {rounds.map((r) => (
                                <th
                                    key={r.index}
                                    className="p-2 text-right font-semibold"
                                >
                                    Runde {r.index + 1}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {alternatives.map((alt) => (
                            <tr
                                key={alt.id}
                                className={`border-b ${alt.isWinner ? 'font-semibold' : ''}`}
                            >
                                <td className="p-2">{alt.text}</td>
                                {rounds.map((r) => {
                                    const vc = r.alternativeVoteCounts.find(
                                        (v) => v.alternativeId === alt.id,
                                    );
                                    return (
                                        <td
                                            key={r.index}
                                            className="p-2 text-right"
                                        >
                                            {vc ? vc.voteCount.toFixed(2) : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        <tr className="font-semibold italic">
                            <td className="p-2">Kvote</td>
                            {rounds.map((r) => (
                                <td key={r.index} className="p-2 text-right">
                                    {quota.toFixed(2)}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DownloadResultButton({
    alternatives,
    result,
}: {
    alternatives: Array<{
        text: string;
        voteCount: number;
        isWinner: boolean;
    }>;
    result: { votingEligibleCount: number; voteCount: number } | null;
}) {
    function handleDownload() {
        const rows = [
            ['Alternativ', 'Stemmer', 'Vinner'],
            ...alternatives.map((a) => [
                a.text,
                String(a.voteCount),
                a.isWinner ? 'Ja' : 'Nei',
            ]),
        ];

        if (result) {
            rows.push([]);
            rows.push([
                'Stemmeberettigede',
                String(result.votingEligibleCount),
            ]);
            rows.push(['Totalt avgitte stemmer', String(result.voteCount)]);
        }

        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'resultater.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <Button variant="outline" size="sm" onClick={handleDownload}>
            Last ned CSV
        </Button>
    );
}
