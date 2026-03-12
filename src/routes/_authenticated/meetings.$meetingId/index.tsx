import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getMeetingById, updateMeeting } from '#/server/meetings.ts';
import {
    getVotationsForMeeting,
    getActiveVotationId,
} from '#/server/votations.ts';
import { startNextVotation } from '#/server/voting.ts';
import {
    getPendingParticipants,
    approveParticipant,
    denyParticipant,
} from '#/server/participants.ts';
import AdminBar from '#/components/AdminBar';
import VotationList from '#/components/VotationList';
import ActiveVotation from '#/components/ActiveVotation';
import ManageParticipants from '#/components/ManageParticipants';
import StatusBadge from '#/components/StatusBadge';
import { Button } from '#/components/ui/button';
import { useWsSubscription } from '#/hooks/useWsSubscription';

export const Route = createFileRoute('/_authenticated/meetings/$meetingId/')({
    component: MeetingLobby,
});

function MeetingLobby() {
    const { meetingId } = Route.useParams();
    const { session } = Route.useRouteContext();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('votations');

    const { data: meeting } = useQuery({
        queryKey: ['meeting', meetingId],
        queryFn: () => getMeetingById({ data: { meetingId } }),
    });

    const { data: votations } = useQuery({
        queryKey: ['votations', meetingId],
        queryFn: () => getVotationsForMeeting({ data: { meetingId } }),
    });

    const { data: activeVotationId } = useQuery({
        queryKey: ['activeVotation', meetingId],
        queryFn: () => getActiveVotationId({ data: { meetingId } }),
    });

    const myParticipant = meeting?.participants?.find(
        (p) => p.userId === session.user.id,
    );
    const isAdmin = myParticipant?.role === 'ADMIN';
    const isCounter = myParticipant?.role === 'COUNTER';
    const isAdminOrCounter = isAdmin || isCounter;
    const canVote = myParticipant
        ? myParticipant.role !== 'ADMIN' && myParticipant.isVotingEligible
        : false;

    const { data: pendingParticipants } = useQuery({
        queryKey: ['pendingParticipants', meetingId],
        queryFn: () => getPendingParticipants({ data: { meetingId } }),
        enabled: isAdminOrCounter,
    });

    const pendingCount = pendingParticipants?.length ?? 0;

    useWsSubscription(`meeting:${meetingId}:votation-opened`, {
        invalidate: [
            ['activeVotation', meetingId],
            ['votations', meetingId],
            ['meeting', meetingId],
        ],
        onMessage: () => setActiveTab('active'),
    });

    useWsSubscription(`meeting:${meetingId}:votations-updated`, {
        invalidate: [['votations', meetingId]],
    });

    useWsSubscription(
        isAdminOrCounter ? `meeting:${meetingId}:participant-pending` : '',
        {
            invalidate: [['pendingParticipants', meetingId]],
        },
    );

    useWsSubscription(
        isAdminOrCounter ? `meeting:${meetingId}:participants-updated` : '',
        {
            invalidate: [
                ['pendingParticipants', meetingId],
                ['participants', meetingId],
                ['meeting', meetingId],
            ],
        },
    );

    const startMutation = useMutation({
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
            setActiveTab('active');
        },
        onError: (err) => {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke starte votering',
            );
        },
    });

    const statusMutation = useMutation({
        mutationFn: (status: 'ONGOING' | 'ENDED') =>
            updateMeeting({ data: { meetingId, status } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['meeting', meetingId],
            });
        },
        onError: (err) => {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke oppdatere møtestatus',
            );
        },
    });

    // Auto-switch to active tab when a votation becomes active
    useEffect(() => {
        if (activeVotationId && activeTab === 'votations') {
            setActiveTab('active');
        }
    }, [activeVotationId]);

    if (!meeting) return null;

    const manageTabs = [
        { id: 'votations', label: 'Voteringer' },
        { id: 'active', label: 'Aktiv votering' },
        {
            id: 'participants',
            label: 'Deltakere',
            badge: pendingCount > 0 ? pendingCount : undefined,
        },
        { id: 'selfregistration', label: 'Registrering' },
    ];

    return (
        <main className="mx-auto max-w-5xl px-4 py-8">
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
                                onClick={() => statusMutation.mutate('ENDED')}
                                disabled={statusMutation.isPending}
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

            {meeting.description && (
                <p className="mb-6 text-muted-foreground">
                    {meeting.description}
                </p>
            )}

            {isAdminOrCounter && (
                <AdminBar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    tabs={manageTabs}
                    onStartNextVotation={
                        isAdmin ? () => startMutation.mutate() : undefined
                    }
                    startingVotation={startMutation.isPending}
                />
            )}

            {activeTab === 'votations' && (
                <VotationList
                    votations={votations ?? []}
                    meetingId={meetingId}
                    isAdmin={!!isAdmin}
                    openVotationId={activeVotationId ?? null}
                    onViewActive={() => setActiveTab('active')}
                />
            )}

            {activeTab === 'active' && (
                <ActiveVotation
                    meetingId={meetingId}
                    activeVotationId={activeVotationId ?? null}
                    isAdmin={!!isAdmin}
                    isAdminOrCounter={isAdminOrCounter}
                    canVote={canVote}
                />
            )}

            {activeTab === 'participants' && isAdminOrCounter && (
                <ParticipantsPanel
                    meetingId={meetingId}
                    pendingParticipants={pendingParticipants ?? []}
                />
            )}

            {activeTab === 'selfregistration' && isAdminOrCounter && (
                <SelfRegistrationPanel
                    meetingId={meetingId}
                    allowSelfRegistration={meeting.allowSelfRegistration}
                />
            )}
        </main>
    );
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
        mutationFn: async () => {
            for (const p of pendingParticipants) {
                await approveParticipant({
                    data: { meetingId, participantId: p.id },
                });
            }
        },
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

function SelfRegistrationPanel({
    meetingId,
    allowSelfRegistration,
}: {
    meetingId: string;
    allowSelfRegistration: boolean;
}) {
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

    const regUrl =
        typeof window !== 'undefined'
            ? `${window.location.origin}/join/${meetingId}`
            : '';

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
            <div className="flex justify-center">
                <QRCode meetingId={meetingId} />
            </div>
        </div>
    );
}

function QRCode({ meetingId }: { meetingId: string }) {
    const url =
        typeof window !== 'undefined'
            ? `${window.location.origin}/join/${meetingId}`
            : '';

    if (!url) return null;

    return <QRCodeDisplay value={url} />;
}

function QRCodeDisplay({ value }: { value: string }) {
    const [QRCodeSVG, setQRCodeSVG] = useState<React.ComponentType<{
        value: string;
        size: number;
    }> | null>(null);

    useEffect(() => {
        void import('qrcode.react').then((mod) => {
            setQRCodeSVG(() => mod.QRCodeSVG);
        });
    }, []);

    if (!QRCodeSVG)
        return (
            <div className="h-[200px] w-[200px] animate-pulse rounded bg-muted" />
        );

    return <QRCodeSVG value={value} size={200} />;
}
