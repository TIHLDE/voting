import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { getMeetingById, updateMeeting } from '#/server/meetings';
import { startNextVotation } from '#/server/voting';
import { getVotationsForMeeting } from '#/server/votations';
import {
    approveParticipant,
    denyParticipant,
    getPendingParticipants,
} from '#/server/participants';
import AdminBar from './-components/AdminBar';
import VotationList from './-components/VotationList';
import ActiveVotation from './-components/ActiveVotation';
import ManageParticipants from './-components/ManageParticipants';
import StatusBadge from '#/components/StatusBadge';
import { Button } from '#/components/ui/button';
import { useLiveQuerySubscription } from '#/hooks/useLiveQuerySubscription';
import { liveEvents } from '#/lib/live-events';
import {
    activeVotationQuery,
    meetingQuery,
    participantsQuery,
    pendingParticipantsQuery,
    votationsQuery,
} from '#/queries/live';

export const Route = createFileRoute('/_authenticated/meetings/$meetingId/')({
    component: MeetingLobby,
});

function MeetingLobby() {
    const { meetingId } = Route.useParams();
    const { session } = Route.useRouteContext();
    const [activeTab, setActiveTab] = useState('votations');

    const { data: meeting } = useQuery(meetingQuery(meetingId));

    const { data: votations } = useQuery(votationsQuery(meetingId));

    const { data: activeVotationId } = useQuery(activeVotationQuery(meetingId));

    const myParticipant = meeting?.participants?.find(
        (p) => p.userId === session.user.id,
    );
    const isAdmin = myParticipant?.role === 'ADMIN';
    const isCounter = myParticipant?.role === 'COUNTER';
    const isAdminOrCounter = isAdmin || isCounter;
    const { data: pendingParticipants } = useQuery({
        ...pendingParticipantsQuery(meetingId),
        enabled: isAdminOrCounter,
    });

    useLiveQuerySubscription(liveEvents.meetingVotationOpened(meetingId), {
        invalidate: [
            activeVotationQuery(meetingId),
            votationsQuery(meetingId),
            meetingQuery(meetingId),
        ],
        onMessage: () => setActiveTab('active'),
    });

    useLiveQuerySubscription(liveEvents.meetingVotationsUpdated(meetingId), {
        invalidate: [votationsQuery(meetingId)],
    });

    useLiveQuerySubscription(
        isAdminOrCounter
            ? liveEvents.meetingParticipantPending(meetingId)
            : null,
        { invalidate: [pendingParticipantsQuery(meetingId)] },
    );

    useLiveQuerySubscription(
        isAdminOrCounter
            ? liveEvents.meetingParticipantsUpdated(meetingId)
            : null,
        {
            invalidate: [
                pendingParticipantsQuery(meetingId),
                participantsQuery(meetingId),
                meetingQuery(meetingId),
            ],
        },
    );

    // Auto-switch to active tab when a votation becomes active
    useEffect(() => {
        if (activeVotationId) {
            setActiveTab((current) =>
                current === 'votations' ? 'active' : current,
            );
        }
    }, [activeVotationId]);

    if (!meeting) return null;

    return (
        <main className="mx-auto max-w-5xl px-4 py-8">
            <MeetingHeader
                meeting={meeting}
                meetingId={meetingId}
                isAdmin={!!isAdmin}
                isAdminOrCounter={isAdminOrCounter}
            />
            {meeting.description && (
                <p className="mb-6 text-muted-foreground">
                    {meeting.description}
                </p>
            )}
            {isAdminOrCounter && (
                <MeetingAdminBar
                    meetingId={meetingId}
                    activeTab={activeTab}
                    pendingCount={pendingParticipants?.length ?? 0}
                    canStartVotation={!!isAdmin}
                    onTabChange={setActiveTab}
                />
            )}
            <MeetingContent
                activeTab={activeTab}
                meeting={meeting}
                votations={votations ?? []}
                pendingParticipants={pendingParticipants ?? []}
                meetingId={meetingId}
                activeVotationId={activeVotationId ?? null}
                userId={session.user.id}
                onTabChange={setActiveTab}
            />
        </main>
    );
}

type MeetingData = Awaited<ReturnType<typeof getMeetingById>>;
type VotationsData = Awaited<ReturnType<typeof getVotationsForMeeting>>;
type PendingParticipantsData = Awaited<
    ReturnType<typeof getPendingParticipants>
>;
function MeetingHeader({
    meeting,
    meetingId,
    isAdmin,
    isAdminOrCounter,
}: {
    meeting: MeetingData;
    meetingId: string;
    isAdmin: boolean;
    isAdminOrCounter: boolean;
}) {
    const queryClient = useQueryClient();
    const endMeeting = useMutation({
        mutationFn: () =>
            updateMeeting({ data: { meetingId, status: 'ENDED' } }),
        onSuccess: () => queryClient.invalidateQueries(meetingQuery(meetingId)),
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke oppdatere møtestatus'),
    });

    return (
        <div className="mb-6 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">
                {meeting.title}
            </h1>
            <StatusBadge status={meeting.status} />
            {isAdminOrCounter && (
                <div className="ml-auto flex gap-2">
                    {isAdmin && meeting.status === 'ONGOING' && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => endMeeting.mutate()}
                            disabled={endMeeting.isPending}
                        >
                            Avslutt møte
                        </Button>
                    )}
                    {isAdmin && (
                        <Link
                            to="/meetings/$meetingId/edit"
                            params={{ meetingId }}
                        >
                            <Button size="sm" variant="outline">
                                Rediger
                            </Button>
                        </Link>
                    )}
                    <Link
                        to="/meetings/$meetingId/present"
                        params={{ meetingId }}
                        target="_blank"
                    >
                        <Button size="sm" variant="outline">
                            Presentasjon
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}

function MeetingAdminBar({
    meetingId,
    activeTab,
    pendingCount,
    canStartVotation,
    onTabChange,
}: {
    meetingId: string;
    activeTab: string;
    pendingCount: number;
    canStartVotation: boolean;
    onTabChange: (tab: string) => void;
}) {
    const queryClient = useQueryClient();
    const startVotation = useMutation({
        mutationFn: () => startNextVotation({ data: { meetingId } }),
        onSuccess: () => {
            void Promise.all([
                queryClient.invalidateQueries(activeVotationQuery(meetingId)),
                queryClient.invalidateQueries(votationsQuery(meetingId)),
                queryClient.invalidateQueries(meetingQuery(meetingId)),
            ]);
            onTabChange('active');
        },
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke starte votering'),
    });

    return (
        <AdminBar
            activeTab={activeTab}
            onTabChange={onTabChange}
            tabs={[
                { id: 'votations', label: 'Voteringer' },
                { id: 'active', label: 'Aktiv votering' },
                {
                    id: 'participants',
                    label: 'Deltakere',
                    badge: pendingCount > 0 ? pendingCount : undefined,
                },
                { id: 'selfregistration', label: 'Registrering' },
            ]}
            onStartNextVotation={
                canStartVotation ? () => startVotation.mutate() : undefined
            }
            startingVotation={startVotation.isPending}
        />
    );
}

function MeetingContent({
    activeTab,
    meeting,
    votations,
    pendingParticipants,
    meetingId,
    activeVotationId,
    userId,
    onTabChange,
}: {
    activeTab: string;
    meeting: MeetingData;
    votations: VotationsData;
    pendingParticipants: PendingParticipantsData;
    meetingId: string;
    activeVotationId: string | null;
    userId: string;
    onTabChange: (tab: string) => void;
}) {
    const participant = meeting.participants.find(
        (item) => item.userId === userId,
    );
    const isAdmin = participant?.role === 'ADMIN';
    const isAdminOrCounter = isAdmin || participant?.role === 'COUNTER';

    switch (activeTab) {
        case 'votations':
            return (
                <VotationList
                    votations={votations}
                    meetingId={meetingId}
                    isAdmin={isAdmin}
                    openVotationId={activeVotationId}
                    onViewActive={() => onTabChange('active')}
                />
            );
        case 'active':
            return (
                <ActiveVotation
                    meetingId={meetingId}
                    activeVotationId={activeVotationId}
                    isAdmin={isAdmin}
                    isAdminOrCounter={isAdminOrCounter}
                    canVote={
                        !!participant &&
                        participant.role !== 'ADMIN' &&
                        participant.isVotingEligible
                    }
                />
            );
        case 'participants':
            return isAdminOrCounter ? (
                <ParticipantsPanel
                    meetingId={meetingId}
                    pendingParticipants={pendingParticipants}
                />
            ) : null;
        case 'selfregistration':
            return isAdminOrCounter ? (
                <SelfRegistrationPanel
                    meetingId={meetingId}
                    allowSelfRegistration={meeting.allowSelfRegistration}
                />
            ) : null;
        default:
            return null;
    }
}

function ParticipantsPanel({
    meetingId,
    pendingParticipants,
}: {
    meetingId: string;
    pendingParticipants: Array<{
        id: string;
        user: { name: string; email: string };
    }>;
}) {
    const queryClient = useQueryClient();

    const approveMutation = useMutation({
        mutationFn: (participantId: string) =>
            approveParticipant({ data: { meetingId, participantId } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['pendingParticipants', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['participants', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['meeting', meetingId],
            });
        },
    });

    const denyMutation = useMutation({
        mutationFn: (participantId: string) =>
            denyParticipant({ data: { meetingId, participantId } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['pendingParticipants', meetingId],
            });
        },
    });

    const approveAllMutation = useMutation({
        mutationFn: () =>
            Promise.all(
                pendingParticipants.map((participant) =>
                    approveParticipant({
                        data: {
                            meetingId,
                            participantId: participant.id,
                        },
                    }),
                ),
            ),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['pendingParticipants', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['participants', meetingId],
            });
            void queryClient.invalidateQueries({
                queryKey: ['meeting', meetingId],
            });
        },
    });

    return (
        <div className="space-y-6">
            {pendingParticipants.length > 0 && (
                <div className="rounded-xl border-2 border-amber-500/30 bg-amber-50 p-6 dark:bg-amber-950/20">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-foreground">
                            Venter på godkjenning ({pendingParticipants.length})
                        </h3>
                        {pendingParticipants.length > 1 && (
                            <Button
                                size="sm"
                                onClick={() => approveAllMutation.mutate()}
                                disabled={approveAllMutation.isPending}
                            >
                                {approveAllMutation.isPending
                                    ? 'Godkjenner...'
                                    : 'Godkjenn alle'}
                            </Button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {pendingParticipants.map((p) => (
                            <div
                                key={p.id}
                                className="flex items-center gap-3 rounded-lg border bg-background p-3"
                            >
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                        {p.user.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {p.user.email}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => approveMutation.mutate(p.id)}
                                    disabled={approveMutation.isPending}
                                >
                                    Godkjenn
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => denyMutation.mutate(p.id)}
                                    disabled={denyMutation.isPending}
                                >
                                    Avvis
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {pendingParticipants.length === 0 && (
                <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
                    <p className="text-sm text-muted-foreground">
                        Ingen ventende forespørsler.
                    </p>
                </div>
            )}

            <ManageParticipants meetingId={meetingId} />
        </div>
    );
}

const subscribeToOrigin = () => () => {};

function useOrigin() {
    return useSyncExternalStore(
        subscribeToOrigin,
        () => window.location.origin,
        () => '',
    );
}

function SelfRegistrationPanel({
    meetingId,
    allowSelfRegistration,
}: {
    meetingId: string;
    allowSelfRegistration: boolean;
}) {
    const origin = useOrigin();
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    async function copyQrCode() {
        const canvas = qrCanvasRef.current;
        if (!canvas) return;

        try {
            // Pass the blob as a promise so Safari keeps the user gesture.
            const png = new Promise<Blob>((resolve, reject) =>
                canvas.toBlob((blob) =>
                    blob ? resolve(blob) : reject(new Error('toBlob failed')),
                ),
            );
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': png }),
            ]);
            toast.success('QR-kode kopiert');
        } catch {
            toast.error('Kunne ikke kopiere QR-koden');
        }
    }

    if (!allowSelfRegistration) {
        return (
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
                <p className="text-muted-foreground">
                    Selvregistrering er ikke aktivert for dette møtet. Du kan
                    aktivere det i møteinnstillingene.
                </p>
            </div>
        );
    }

    const regUrl = origin ? `${origin}/join/${meetingId}` : '';

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
                Selvregistrering
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
                Del denne lenken eller QR-koden med deltakere som skal
                registrere seg selv. Deltakere som registrerer seg må godkjennes
                under Deltakere-fanen.
            </p>
            <div className="mb-4 flex items-center gap-2">
                <code className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm">
                    {regUrl}
                </code>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        void navigator.clipboard.writeText(regUrl);
                        toast.success('Lenke kopiert');
                    }}
                >
                    Kopier
                </Button>
            </div>
            <div className="flex flex-col items-center gap-3">
                {regUrl ? (
                    <>
                        <div className="rounded-lg bg-white p-4">
                            <QRCodeSVG value={regUrl} size={200} />
                        </div>
                        {/* Higher resolution copy, with a white margin, for the clipboard */}
                        <QRCodeCanvas
                            ref={qrCanvasRef}
                            value={regUrl}
                            size={512}
                            marginSize={4}
                            className="hidden"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copyQrCode()}
                        >
                            Kopier QR-kode
                        </Button>
                    </>
                ) : (
                    <div className="h-[200px] w-[200px] animate-pulse rounded bg-muted" />
                )}
            </div>
        </div>
    );
}
