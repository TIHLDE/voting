import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
    castVote,
    castBlankVote,
    castStvVote,
    updateVotationStatus,
} from '#/server/voting';
import { Button } from '#/components/ui/button';
import { useLiveQuerySubscription } from '#/hooks/useLiveQuerySubscription';
import { liveEvents } from '#/lib/live-events';
import { moveRankingItem, renumberRanking } from '#/lib/stv-ranking';
import type { StvRanking } from '#/lib/stv-ranking';
import {
    hasVotedQuery,
    notVotedQuery,
    resultsQuery,
    votationQuery,
    votationsQuery,
    voteCountQuery,
} from '#/queries/live';
import VotationResultView from './VotationResult';
import CheckResults from './CheckResults';

interface ActiveVotationProps {
    meetingId: string;
    activeVotationId: string | null;
    isAdmin: boolean;
    isAdminOrCounter: boolean;
    canVote: boolean;
}

export default function ActiveVotation({
    meetingId,
    activeVotationId,
    isAdmin,
    isAdminOrCounter,
    canVote,
}: ActiveVotationProps) {
    const { data: votation } = useQuery({
        ...votationQuery(activeVotationId ?? ''),
        enabled: !!activeVotationId,
    });

    useLiveQuerySubscription(
        activeVotationId ? liveEvents.votationStatus(activeVotationId) : null,
        {
            invalidate: activeVotationId
                ? [
                      votationQuery(activeVotationId),
                      votationsQuery(meetingId),
                      hasVotedQuery(activeVotationId),
                      voteCountQuery(activeVotationId),
                      resultsQuery(activeVotationId),
                  ]
                : [],
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
                    type={votation.type}
                    alternatives={votation.alternatives}
                    blankVotes={votation.blankVotes}
                    isAdmin={isAdmin}
                    isAdminOrCounter={isAdminOrCounter}
                    canVote={canVote}
                />
            )}

            {votation.status === 'CHECKING_RESULT' && (
                <CheckResults
                    votationId={votation.id}
                    meetingId={meetingId}
                    isAdmin={isAdmin}
                    isAdminOrCounter={isAdminOrCounter}
                />
            )}

            {votation.status === 'PUBLISHED_RESULT' && (
                <VotationResultView
                    votationId={votation.id}
                    meetingId={meetingId}
                    isAdmin={isAdmin}
                    isAdminOrCounter={isAdminOrCounter}
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
    type,
    alternatives,
    blankVotes,
    isAdmin,
    isAdminOrCounter,
    canVote,
}: {
    votationId: string;
    type: string;
    alternatives: Array<{ id: string; text: string }>;
    blankVotes: boolean;
    isAdmin: boolean;
    isAdminOrCounter: boolean;
    canVote: boolean;
}) {
    // Check if user already voted (survives page refresh)
    const { data: hasVotedData } = useQuery({
        ...hasVotedQuery(votationId),
        enabled: canVote,
    });

    const hasVoted = hasVotedData?.hasVoted ?? false;

    const { data: voteCount } = useQuery(voteCountQuery(votationId));

    useLiveQuerySubscription(liveEvents.votationVotes(votationId), {
        setQueryData: voteCountQuery(votationId),
    });

    const footer = (
        <VotingFooter
            votationId={votationId}
            voteCount={voteCount}
            isAdmin={isAdmin}
            isAdminOrCounter={isAdminOrCounter}
        />
    );

    if (!canVote) {
        return <VotingUnavailable isAdmin={isAdmin} footer={footer} />;
    }
    if (hasVoted) return <VoteSubmitted footer={footer} />;
    if (type === 'STV') {
        return (
            <StvVotingForm
                votationId={votationId}
                alternatives={alternatives}
                blankVotes={blankVotes}
                footer={footer}
            />
        );
    }

    return (
        <ChoiceVotingForm
            votationId={votationId}
            alternatives={alternatives}
            blankVotes={blankVotes}
            footer={footer}
        />
    );
}

function VotingUnavailable({
    isAdmin,
    footer,
}: {
    isAdmin: boolean;
    footer: React.ReactNode;
}) {
    return (
        <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
                <p className="font-medium text-muted-foreground">
                    {isAdmin
                        ? 'Administratorer kan ikke stemme.'
                        : 'Du har ikke stemmerett i denne voteringen.'}
                </p>
            </div>
            {footer}
        </div>
    );
}

function VoteSubmitted({ footer }: { footer: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
                <p className="font-semibold text-green-700 dark:text-green-300">
                    Din stemme er registrert!
                </p>
            </div>
            {footer}
        </div>
    );
}

type VotingAlternative = { id: string; text: string };

function StvVotingForm({
    votationId,
    alternatives,
    blankVotes,
    footer,
}: {
    votationId: string;
    alternatives: VotingAlternative[];
    blankVotes: boolean;
    footer: React.ReactNode;
}) {
    const [ranking, setRanking] = useState<StvRanking[]>([]);
    const { onSuccess, onError } = useVoteCallbacks(votationId);
    const stvMutation = useMutation({
        mutationFn: () =>
            castStvVote({ data: { votationId, alternatives: ranking } }),
        onSuccess,
        onError,
    });
    const blankMutation = useMutation({
        mutationFn: () => castBlankVote({ data: { votationId } }),
        onSuccess,
        onError,
    });
    const shuffled = useShuffledAlternatives(alternatives);
    const available = shuffled.filter(
        (alternative) =>
            !ranking.some((item) => item.alternativeId === alternative.id),
    );
    const isComplete = ranking.length === alternatives.length;

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Ranger alternativene etter preferanse. Klikk for å legge til i
                rangeringen, og bruk pilene for å endre rekkefølgen.
            </p>
            <div
                className={`rounded-lg border p-3 text-sm ${
                    isComplete
                        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                        : 'bg-muted/50 text-foreground'
                }`}
                aria-live="polite"
            >
                <p className="font-medium">
                    {isComplete
                        ? 'Alle alternativene er rangert. Du kan nå avgi stemme.'
                        : `Du må rangere alle alternativene før du kan avgi stemme${
                              blankVotes ? ', eller stemme blankt' : ''
                          }.`}
                </p>
                <p className="text-muted-foreground">
                    {ranking.length} av {alternatives.length} rangert
                </p>
            </div>
            {ranking.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Din rangering:</h3>
                    {ranking.map((item, index) => (
                        <div
                            key={item.alternativeId}
                            className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 p-3"
                        >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                {index + 1}
                            </span>
                            <span className="text-sm">
                                {
                                    alternatives.find(
                                        (alternative) =>
                                            alternative.id ===
                                            item.alternativeId,
                                    )?.text
                                }
                            </span>
                            <div className="ml-auto flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Flytt opp"
                                    disabled={index === 0}
                                    onClick={() =>
                                        setRanking((current) =>
                                            moveRankingItem(current, index, -1),
                                        )
                                    }
                                >
                                    <ArrowUpIcon />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Flytt ned"
                                    disabled={index === ranking.length - 1}
                                    onClick={() =>
                                        setRanking((current) =>
                                            moveRankingItem(current, index, 1),
                                        )
                                    }
                                >
                                    <ArrowDownIcon />
                                </Button>
                                <button
                                    type="button"
                                    className="ml-1 text-xs text-destructive hover:underline"
                                    onClick={() =>
                                        setRanking((current) =>
                                            renumberRanking(
                                                current.filter(
                                                    (_, currentIndex) =>
                                                        currentIndex !== index,
                                                ),
                                            ),
                                        )
                                    }
                                >
                                    Fjern
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {available.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Tilgjengelige:</h3>
                    {available.map((alternative) => (
                        <button
                            key={alternative.id}
                            type="button"
                            onClick={() =>
                                setRanking((current) => [
                                    ...current,
                                    {
                                        alternativeId: alternative.id,
                                        ranking: current.length + 1,
                                    },
                                ])
                            }
                            className="w-full rounded-lg border bg-card p-3 text-left text-sm transition hover:border-primary"
                        >
                            {alternative.text}
                        </button>
                    ))}
                </div>
            )}
            <VoteButtons
                blankVotes={blankVotes}
                disabled={!isComplete}
                submitting={stvMutation.isPending}
                submittingBlank={blankMutation.isPending}
                onSubmit={() => stvMutation.mutate()}
                onSubmitBlank={() => blankMutation.mutate()}
            />
            {footer}
        </div>
    );
}

function ChoiceVotingForm({
    votationId,
    alternatives,
    blankVotes,
    footer,
}: {
    votationId: string;
    alternatives: VotingAlternative[];
    blankVotes: boolean;
    footer: React.ReactNode;
}) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { onSuccess, onError } = useVoteCallbacks(votationId);
    const voteMutation = useMutation({
        mutationFn: () => castVote({ data: { alternativeId: selectedId! } }),
        onSuccess,
        onError,
    });
    const blankMutation = useMutation({
        mutationFn: () => castBlankVote({ data: { votationId } }),
        onSuccess,
        onError,
    });
    const shuffled = useShuffledAlternatives(alternatives);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                {shuffled.map((alternative) => (
                    <button
                        key={alternative.id}
                        type="button"
                        onClick={() => setSelectedId(alternative.id)}
                        className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                            selectedId === alternative.id
                                ? 'border-primary bg-primary/10 font-semibold'
                                : 'bg-card hover:border-primary'
                        }`}
                    >
                        {alternative.text}
                    </button>
                ))}
            </div>
            <VoteButtons
                blankVotes={blankVotes}
                disabled={!selectedId}
                submitting={voteMutation.isPending}
                submittingBlank={blankMutation.isPending}
                onSubmit={() => voteMutation.mutate()}
                onSubmitBlank={() => blankMutation.mutate()}
            />
            {footer}
        </div>
    );
}

function useVoteCallbacks(votationId: string) {
    const queryClient = useQueryClient();
    return {
        onSuccess: () => {
            queryClient.setQueryData(hasVotedQuery(votationId).queryKey, {
                hasVoted: true,
            });
            toast.success('Din stemme er registrert!');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Kunne ikke avgi stemme');
        },
    };
}

function useShuffledAlternatives(alternatives: VotingAlternative[]) {
    return useMemo(() => {
        const shuffled = [...alternatives];
        for (let index = shuffled.length - 1; index > 0; index--) {
            const target = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[target]] = [
                shuffled[target],
                shuffled[index],
            ];
        }
        return shuffled;
    }, [alternatives]);
}

function VoteButtons({
    blankVotes,
    disabled,
    submitting,
    submittingBlank,
    onSubmit,
    onSubmitBlank,
}: {
    blankVotes: boolean;
    disabled: boolean;
    submitting: boolean;
    submittingBlank: boolean;
    onSubmit: () => void;
    onSubmitBlank: () => void;
}) {
    return (
        <div className="flex gap-2">
            <Button
                onClick={onSubmit}
                disabled={disabled || submitting}
                className="flex-1"
            >
                {submitting ? 'Sender...' : 'Avgi stemme'}
            </Button>
            {blankVotes && (
                <Button
                    variant="outline"
                    onClick={onSubmitBlank}
                    disabled={submittingBlank}
                >
                    {submittingBlank ? 'Sender...' : 'Blank stemme'}
                </Button>
            )}
        </div>
    );
}

function VotingFooter({
    votationId,
    voteCount,
    isAdmin,
    isAdminOrCounter,
}: {
    votationId: string;
    voteCount?: { voteCount: number; votingEligibleCount: number } | null;
    isAdmin: boolean;
    isAdminOrCounter: boolean;
}) {
    const queryClient = useQueryClient();
    const closeMutation = useMutation({
        mutationFn: () =>
            updateVotationStatus({
                data: { votationId, status: 'CHECKING_RESULT' },
            }),
        onSuccess: () =>
            queryClient.invalidateQueries(votationQuery(votationId)),
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke avslutte votering'),
    });
    const invalidateMutation = useMutation({
        mutationFn: () =>
            updateVotationStatus({
                data: { votationId, status: 'INVALID' },
            }),
        onSuccess: () =>
            queryClient.invalidateQueries(votationQuery(votationId)),
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke ugyldiggjøre votering'),
    });

    return (
        <>
            <VoteCountDisplay voteCount={voteCount} />
            {isAdminOrCounter && <NotVotedList votationId={votationId} />}
            {isAdmin && (
                <AdminVotingControls
                    onClose={() => closeMutation.mutate()}
                    onInvalidate={() => invalidateMutation.mutate()}
                    closing={closeMutation.isPending}
                    invalidating={invalidateMutation.isPending}
                />
            )}
        </>
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

function NotVotedList({ votationId }: { votationId: string }) {
    const [open, setOpen] = useState(false);

    const { data: notVoted } = useQuery({
        ...notVotedQuery(votationId),
        refetchInterval: 10000,
    });

    useLiveQuerySubscription(liveEvents.votationVotes(votationId), {
        invalidate: [notVotedQuery(votationId)],
    });

    if (!notVoted || notVoted.length === 0) return null;

    return (
        <div className="rounded-lg border bg-muted/30 p-4">
            <button
                type="button"
                className="flex w-full items-center gap-2 text-sm font-semibold text-foreground"
                onClick={() => setOpen(!open)}
            >
                <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                />
                Har ikke stemt enn\u00e5 ({notVoted.length})
            </button>
            {open && (
                <div className="mt-2 space-y-1">
                    {notVoted.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm"
                        >
                            <span>{p.name}</span>
                            <span className="text-muted-foreground">
                                {p.email}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
