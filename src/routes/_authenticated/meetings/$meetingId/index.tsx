import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getMeetingById, updateMeeting } from '#/server/meetings';
import { startNextVotation } from '#/server/voting';
import { getVotationsForMeeting } from '#/server/votations';
import { getPendingParticipants } from '#/server/participants';
import AdminBar from './-components/AdminBar';
import VotationList from './-components/VotationList';
import ActiveVotation from './-components/ActiveVotation';
import ConfirmDialog from '#/components/ConfirmDialog';
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
import { SelfRegistrationPanel } from './-tabs/register';
import { ParticipantsPanel } from './-tabs/participants';

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
    const [confirmEnd, setConfirmEnd] = useState(false);

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
                            onClick={() => setConfirmEnd(true)}
                            disabled={endMeeting.isPending}
                        >
                            Avslutt møte
                        </Button>
                    )}
                    <ConfirmDialog
                        open={confirmEnd}
                        onOpenChange={setConfirmEnd}
                        title="Avslutte møtet?"
                        description={
                            <>
                                «{meeting.title}» blir markert som avsluttet og
                                flyttes til «Avsluttede» i møteoversikten.
                            </>
                        }
                        confirmLabel="Avslutt møte"
                        actionVariant="destructive"
                        onConfirm={() => endMeeting.mutate()}
                    />
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
