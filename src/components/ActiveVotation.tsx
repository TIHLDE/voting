import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { getVotationById } from '#/server/votations.ts';
import {
    castVote,
    castBlankVote,
    castStvVote,
    getVoteCount,
    getHasVoted,
    updateVotationStatus,
} from '#/server/voting.ts';
import { Button } from '#/components/ui/button';
import { useWsSubscription } from '#/hooks/useWsSubscription';
import VotationResultView from './VotationResult';
import CheckResults from './CheckResults';

interface ActiveVotationProps {
    meetingId: string;
    activeVotationId: string | null;
    isAdmin: boolean;
    canVote: boolean;
}

export default function ActiveVotation({
    meetingId,
    activeVotationId,
    isAdmin,
    canVote,
}: ActiveVotationProps) {
    const queryClient = useQueryClient();

    const { data: votation } = useQuery({
        queryKey: ['votation', activeVotationId],
        queryFn: () =>
            getVotationById({ data: { votationId: activeVotationId! } }),
        enabled: !!activeVotationId,
    });

    useWsSubscription(
        activeVotationId ? `votation:${activeVotationId}:status` : '',
        {
            invalidate: [
                ['votation', activeVotationId],
                ['votations', meetingId],
                ['hasVoted', activeVotationId],
                ['voteCount', activeVotationId],
                ['results', activeVotationId],
            ],
        },
    );

    if (!activeVotationId) {
        return (
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
                <p className="text-muted-foreground">
                    Ingen aktiv votering.{' '}
                    {isAdmin && 'Klikk "Start neste votering" for å begynne.'}
                </p>
            </div>
        );
    }

    if (!votation) return null;

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-2xl font-bold text-foreground">
                {votation.title}
            </h2>
            {votation.description && (
                <p className="mb-4 text-muted-foreground">
                    {votation.description}
                </p>
            )}

            {votation.status === 'OPEN' && (
                <VotingInterface
                    votationId={votation.id}
                    meetingId={meetingId}
                    type={votation.type}
                    alternatives={votation.alternatives}
                    blankVotes={votation.blankVotes}
                    isAdmin={isAdmin}
                    canVote={canVote}
                />
            )}

            {votation.status === 'CHECKING_RESULT' && (
                <CheckResults
                    votationId={votation.id}
                    meetingId={meetingId}
                    isAdmin={isAdmin}
                />
            )}

            {votation.status === 'PUBLISHED_RESULT' && (
                <VotationResultView
                    votationId={votation.id}
                    meetingId={meetingId}
                    isAdmin={isAdmin}
                />
            )}

            {votation.status === 'INVALID' && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                    <p className="font-semibold text-destructive">
                        Votering avbrutt
                    </p>
                </div>
            )}
        </div>
    );
}

function VotingInterface({
    votationId,
    meetingId,
    type,
    alternatives,
    blankVotes,
    isAdmin,
    canVote,
}: {
    votationId: string;
    meetingId: string;
    type: string;
    alternatives: Array<{ id: string; text: string }>;
    blankVotes: boolean;
    isAdmin: boolean;
    canVote: boolean;
}) {
    const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
    const [stvRanking, setStvRanking] = useState<
        Array<{ alternativeId: string; ranking: number }>
    >([]);
    const queryClient = useQueryClient();

    // Check if user already voted (survives page refresh)
    const { data: hasVotedData } = useQuery({
        queryKey: ['hasVoted', votationId],
        queryFn: () => getHasVoted({ data: { votationId } }),
        enabled: canVote,
    });

    const hasVoted = hasVotedData?.hasVoted ?? false;

    const { data: voteCount } = useQuery({
        queryKey: ['voteCount', votationId],
        queryFn: () => getVoteCount({ data: { votationId } }),
    });

    useWsSubscription(`votation:${votationId}:votes`, {
        setQueryData: ['voteCount', votationId],
    });

    // Shuffle alternatives deterministically per session
    const shuffled = useMemo(() => {
        const arr = [...alternatives];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }, [alternatives]);

    const onVoteSuccess = () => {
        queryClient.setQueryData(['hasVoted', votationId], { hasVoted: true });
        toast.success('Din stemme er registrert!');
    };

    const onVoteError = (err: Error) => {
        toast.error(err.message || 'Kunne ikke avgi stemme');
    };

    const voteMutation = useMutation({
        mutationFn: () => castVote({ data: { alternativeId: selectedAlt! } }),
        onSuccess: onVoteSuccess,
        onError: onVoteError,
    });

    const blankMutation = useMutation({
        mutationFn: () => castBlankVote({ data: { votationId } }),
        onSuccess: onVoteSuccess,
        onError: onVoteError,
    });

    const stvMutation = useMutation({
        mutationFn: () =>
            castStvVote({
                data: { votationId, alternatives: stvRanking },
            }),
        onSuccess: onVoteSuccess,
        onError: onVoteError,
    });

    const closeMutation = useMutation({
        mutationFn: () =>
            updateVotationStatus({
                data: { votationId, status: 'CHECKING_RESULT' },
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
                    : 'Kunne ikke avslutte votering',
            );
        },
    });

    const invalidateMutation = useMutation({
        mutationFn: () =>
            updateVotationStatus({
                data: { votationId, status: 'INVALID' },
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
                    : 'Kunne ikke ugyldiggjøre votering',
            );
        },
    });

    if (!canVote) {
        return (
            <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="font-medium text-muted-foreground">
                        {isAdmin
                            ? 'Administratorer kan ikke stemme.'
                            : 'Du har ikke stemmerett i denne voteringen.'}
                    </p>
                </div>
                <VoteCountDisplay voteCount={voteCount} />
                {isAdmin && (
                    <AdminVotingControls
                        onClose={() => closeMutation.mutate()}
                        onInvalidate={() => invalidateMutation.mutate()}
                        closing={closeMutation.isPending}
                        invalidating={invalidateMutation.isPending}
                    />
                )}
            </div>
        );
    }

    if (hasVoted) {
        return (
            <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
                    <p className="font-semibold text-green-700 dark:text-green-300">
                        Din stemme er registrert!
                    </p>
                </div>
                <VoteCountDisplay voteCount={voteCount} />
                {isAdmin && (
                    <AdminVotingControls
                        onClose={() => closeMutation.mutate()}
                        onInvalidate={() => invalidateMutation.mutate()}
                        closing={closeMutation.isPending}
                        invalidating={invalidateMutation.isPending}
                    />
                )}
            </div>
        );
    }

    if (type === 'STV') {
        return (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Ranger alternativene etter preferanse. Klikk for å legge til
                    i rangeringen.
                </p>

                {stvRanking.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold">
                            Din rangering:
                        </h3>
                        {stvRanking.map((r, i) => {
                            const alt = alternatives.find(
                                (a) => a.id === r.alternativeId,
                            );
                            return (
                                <div
                                    key={r.alternativeId}
                                    className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 p-3"
                                >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                        {i + 1}
                                    </span>
                                    <span className="text-sm">{alt?.text}</span>
                                    <button
                                        type="button"
                                        className="ml-auto text-xs text-destructive hover:underline"
                                        onClick={() =>
                                            setStvRanking(
                                                stvRanking
                                                    .filter(
                                                        (_, idx) => idx !== i,
                                                    )
                                                    .map((r, idx) => ({
                                                        ...r,
                                                        ranking: idx + 1,
                                                    })),
                                            )
                                        }
                                    >
                                        Fjern
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Tilgjengelige:</h3>
                    {shuffled
                        .filter(
                            (a) =>
                                !stvRanking.some(
                                    (r) => r.alternativeId === a.id,
                                ),
                        )
                        .map((alt) => (
                            <button
                                key={alt.id}
                                type="button"
                                onClick={() =>
                                    setStvRanking([
                                        ...stvRanking,
                                        {
                                            alternativeId: alt.id,
                                            ranking: stvRanking.length + 1,
                                        },
                                    ])
                                }
                                className="w-full rounded-lg border bg-card p-3 text-left text-sm transition hover:border-primary"
                            >
                                {alt.text}
                            </button>
                        ))}
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={() => stvMutation.mutate()}
                        disabled={
                            stvRanking.length === 0 || stvMutation.isPending
                        }
                        className="flex-1"
                    >
                        {stvMutation.isPending ? 'Sender...' : 'Avgi stemme'}
                    </Button>
                    {blankVotes && (
                        <Button
                            variant="outline"
                            onClick={() => blankMutation.mutate()}
                            disabled={blankMutation.isPending}
                        >
                            {blankMutation.isPending
                                ? 'Sender...'
                                : 'Blank stemme'}
                        </Button>
                    )}
                </div>

                <VoteCountDisplay voteCount={voteCount} />
                {isAdmin && (
                    <AdminVotingControls
                        onClose={() => closeMutation.mutate()}
                        onInvalidate={() => invalidateMutation.mutate()}
                        closing={closeMutation.isPending}
                        invalidating={invalidateMutation.isPending}
                    />
                )}
            </div>
        );
    }

    // Simple / Qualified
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                {shuffled.map((alt) => (
                    <button
                        key={alt.id}
                        type="button"
                        onClick={() => setSelectedAlt(alt.id)}
                        className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                            selectedAlt === alt.id
                                ? 'border-primary bg-primary/10 font-semibold'
                                : 'bg-card hover:border-primary'
                        }`}
                    >
                        {alt.text}
                    </button>
                ))}
            </div>

            <div className="flex gap-2">
                <Button
                    onClick={() => voteMutation.mutate()}
                    disabled={!selectedAlt || voteMutation.isPending}
                    className="flex-1"
                >
                    {voteMutation.isPending ? 'Sender...' : 'Avgi stemme'}
                </Button>
                {blankVotes && (
                    <Button
                        variant="outline"
                        onClick={() => blankMutation.mutate()}
                        disabled={blankMutation.isPending}
                    >
                        {blankMutation.isPending ? 'Sender...' : 'Blank stemme'}
                    </Button>
                )}
            </div>

            <VoteCountDisplay voteCount={voteCount} />
            {isAdmin && (
                <AdminVotingControls
                    onClose={() => closeMutation.mutate()}
                    onInvalidate={() => invalidateMutation.mutate()}
                    closing={closeMutation.isPending}
                    invalidating={invalidateMutation.isPending}
                />
            )}
        </div>
    );
}

function VoteCountDisplay({
    voteCount,
}: {
    voteCount?: { voteCount: number; votingEligibleCount: number } | null;
}) {
    if (!voteCount) return null;

    const percent =
        voteCount.votingEligibleCount > 0
            ? Math.round(
                  (voteCount.voteCount / voteCount.votingEligibleCount) * 100,
              )
            : 0;

    return (
        <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
                {voteCount.voteCount} / {voteCount.votingEligibleCount}
            </p>
            <p className="text-sm text-muted-foreground">
                stemmer avgitt ({percent}%)
            </p>
        </div>
    );
}

function AdminVotingControls({
    onClose,
    onInvalidate,
    closing,
    invalidating,
}: {
    onClose: () => void;
    onInvalidate: () => void;
    closing: boolean;
    invalidating: boolean;
}) {
    return (
        <div className="flex gap-2 border-t pt-4">
            <Button onClick={onClose} disabled={closing || invalidating}>
                {closing ? 'Stenger...' : 'Avslutt votering'}
            </Button>
            <Button
                variant="destructive"
                onClick={onInvalidate}
                disabled={closing || invalidating}
            >
                {invalidating ? 'Avbryter...' : 'Avbryt votering'}
            </Button>
        </div>
    );
}
