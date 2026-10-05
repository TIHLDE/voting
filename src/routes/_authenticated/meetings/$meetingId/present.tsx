import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { Progress } from '#/components/ui/progress';
import { useLiveQuerySubscription } from '#/hooks/useLiveQuerySubscription';
import { liveEvents } from '#/lib/live-events';
import {
    activeVotationQuery,
    meetingQuery,
    reviewCountsQuery,
    reviewerCountQuery,
    resultsQuery,
    votationQuery,
    votationsQuery,
    voteCountQuery,
} from '#/queries/live';

export const Route = createFileRoute(
    '/_authenticated/meetings/$meetingId/present',
)({
    component: PresentationView,
});

function PresentationView() {
    const { meetingId } = Route.useParams();
    const navigate = useNavigate();
    const [currentVotationId, setCurrentVotationId] = useState<string | null>(
        null,
    );
    const [maximized, setMaximized] = useState(false);

    useEffect(() => {
        if (!maximized) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMaximized(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [maximized]);

    const { data: meeting } = useQuery(meetingQuery(meetingId));

    const { data: activeVotationId } = useQuery(activeVotationQuery(meetingId));

    useEffect(() => {
        if (activeVotationId) {
            setCurrentVotationId(activeVotationId);
        }
    }, [activeVotationId]);

    useLiveQuerySubscription(liveEvents.meetingVotationOpened(meetingId), {
        invalidate: [activeVotationQuery(meetingId)],
        onMessage: ({ votationId }) => setCurrentVotationId(votationId),
    });

    useLiveQuerySubscription(liveEvents.meetingUpdated(meetingId), {
        invalidate: [meetingQuery(meetingId)],
    });

    useLiveQuerySubscription(liveEvents.meetingDeleted(meetingId), {
        onMessage: () => void navigate({ to: '/meetings' }),
    });

    // Role changes alter how many admins and counters review results
    useLiveQuerySubscription(liveEvents.meetingParticipantsUpdated(meetingId), {
        invalidate: [reviewerCountQuery(meetingId)],
    });

    if (!meeting) return null;

    return (
        // Maximized covers the app's top bar and footer
        <div
            className={`flex flex-col bg-background ${maximized ? 'fixed inset-0 z-100 overflow-auto' : 'min-h-screen'}`}
        >
            <header className="relative border-b px-12 py-6 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                    {meeting.title}
                </h1>
                <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-4 right-4"
                    aria-label={maximized ? 'Avslutt fullskjerm' : 'Fullskjerm'}
                    title={maximized ? 'Avslutt fullskjerm' : 'Fullskjerm'}
                    onClick={() => setMaximized((current) => !current)}
                >
                    {maximized ? <Minimize2 /> : <Maximize2 />}
                </Button>
            </header>

            <main className="flex flex-1 items-center justify-center p-12">
                {currentVotationId ? (
                    <PresentVotation
                        votationId={currentVotationId}
                        meetingId={meetingId}
                    />
                ) : (
                    <WaitingState />
                )}
            </main>
        </div>
    );
}

function WaitingState() {
    return (
        <div className="text-center">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <div className="h-10 w-10 animate-pulse rounded-full bg-primary/30" />
            </div>
            <p className="text-3xl font-medium text-muted-foreground">
                Venter på neste votering...
            </p>
        </div>
    );
}

function PresentVotation({
    votationId,
    meetingId,
}: {
    votationId: string;
    meetingId: string;
}) {
    const { data: votation } = useQuery(votationQuery(votationId));

    const { data: voteCount } = useQuery({
        ...voteCountQuery(votationId),
        enabled: votation?.status === 'OPEN',
    });

    useLiveQuerySubscription(liveEvents.votationStatus(votationId), {
        invalidate: [
            votationQuery(votationId),
            votationsQuery(meetingId),
            activeVotationQuery(meetingId),
        ],
    });

    useLiveQuerySubscription(
        votation?.status === 'OPEN'
            ? liveEvents.votationVotes(votationId)
            : null,
        { setQueryData: voteCountQuery(votationId) },
    );

    if (!votation) return null;

    return (
        <div className="w-full max-w-4xl text-center">
            <h2 className="mb-4 text-4xl font-bold text-foreground">
                {votation.title}
            </h2>
            {votation.description && (
                <p className="mb-10 text-xl text-muted-foreground">
                    {votation.description}
                </p>
            )}

            {votation.status === 'OPEN' && (
                <VoteProgress voteCount={voteCount} />
            )}

            {votation.status === 'CHECKING_RESULT' && (
                <CheckingResultsPresentation
                    votationId={votationId}
                    meetingId={meetingId}
                />
            )}

            {votation.status === 'PUBLISHED_RESULT' && (
                <PresentResults votationId={votationId} />
            )}

            {votation.status === 'INVALID' && (
                <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-10">
                    <p className="text-3xl font-semibold text-destructive">
                        Votering avbrutt
                    </p>
                </div>
            )}
        </div>
    );
}

function VoteProgress({
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
        <div className="space-y-8">
            <div className="tabular-nums">
                <p className="text-8xl font-bold text-foreground">
                    {voteCount.voteCount}
                    <span className="text-4xl text-muted-foreground">
                        {' '}
                        / {voteCount.votingEligibleCount}
                    </span>
                </p>
                <p className="mt-2 text-2xl text-muted-foreground">
                    stemmer avgitt
                </p>
            </div>

            <div className="mx-auto max-w-2xl">
                <Progress value={percent} className="h-6" />
            </div>

            <p className="text-5xl font-bold text-primary">{percent}%</p>
        </div>
    );
}

function PresentResults({ votationId }: { votationId: string }) {
    const { data: results } = useQuery(resultsQuery(votationId));

    if (!results) return null;

    const { result, alternatives, votation } = results;
    const winners = alternatives.filter((a) => a.isWinner);

    return (
        <div className="space-y-10">
            {winners.length > 0 && (
                <div className="rounded-2xl border-4 border-green-500 bg-green-50 p-10 dark:bg-green-950/50">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-green-600 dark:text-green-400">
                        Vinner
                    </p>
                    <p className="text-5xl font-bold text-foreground">
                        {winners.map((w) => w.text).join(', ')}
                    </p>
                </div>
            )}

            {winners.length === 0 && (
                <div className="rounded-2xl border-2 border-muted bg-card p-10">
                    <p className="text-3xl font-semibold text-foreground">
                        Ingen vinner
                    </p>
                </div>
            )}

            {votation.hiddenVotes ? (
                <p className="text-2xl text-muted-foreground">
                    Detaljerte resultater er skjult for denne voteringen.
                </p>
            ) : (
                <>
                    <table className="mx-auto w-full max-w-3xl text-left text-xl">
                        <thead>
                            <tr className="border-b-2">
                                <th className="p-4 font-semibold">
                                    Alternativ
                                </th>
                                <th className="p-4 text-right font-semibold">
                                    Stemmer
                                </th>
                                <th className="p-4 text-right font-semibold">
                                    %
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {alternatives.map((alt) => (
                                <tr
                                    key={alt.id}
                                    className={`border-b ${alt.isWinner ? 'font-bold text-green-600 dark:text-green-400' : ''}`}
                                >
                                    <td className="p-4">
                                        {alt.text}
                                        {alt.isWinner && ' *'}
                                    </td>
                                    <td className="p-4 text-right">
                                        {alt.voteCount}
                                    </td>
                                    <td className="p-4 text-right">
                                        {result &&
                                        result.votingEligibleCount > 0
                                            ? (
                                                  (alt.voteCount /
                                                      result.votingEligibleCount) *
                                                  100
                                              ).toFixed(1) + '%'
                                            : '0%'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {result && (
                        <p className="text-xl text-muted-foreground">
                            {result.voteCount} av {result.votingEligibleCount}{' '}
                            stemmeberettigede stemte
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

function CheckingResultsPresentation({
    votationId,
    meetingId,
}: {
    votationId: string;
    meetingId: string;
}) {
    const { data: reviewCounts } = useQuery(reviewCountsQuery(votationId));

    const { data: reviewerCount } = useQuery(reviewerCountQuery(meetingId));

    useLiveQuerySubscription(liveEvents.votationReviews(votationId), {
        setQueryData: reviewCountsQuery(votationId),
    });

    const approved = reviewCounts?.approved ?? 0;
    const total = reviewerCount?.total ?? 0;

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-3xl text-muted-foreground">
                Kontrollerer resultater...
            </p>
            {total > 0 && (
                <p className="text-2xl tabular-nums text-foreground">
                    {approved} / {total} har godkjent
                </p>
            )}
        </div>
    );
}
