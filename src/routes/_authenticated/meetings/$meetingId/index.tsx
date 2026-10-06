import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    deleteMeeting,
    getMeetingById,
    updateMeeting,
} from '#/server/meetings';
import { startNextVotation } from '#/server/voting';
import { getVotationsForMeeting } from '#/server/votations';
import { getPendingParticipants } from '#/server/participants';
import AdminBar from './-components/AdminBar';
import VotationList from './-components/VotationList';
import ActiveVotation from './-components/ActiveVotation';
import ConfirmDialog from '#/components/ConfirmDialog';
import StatusBadge from '#/components/StatusBadge';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Check, Pencil, X } from 'lucide-react';
import { useLiveQuerySubscription } from '#/hooks/useLiveQuerySubscription';
import { liveEvents } from '#/lib/live-events';
import {
    activeVotationQuery,
    meetingQuery,
    participantsQuery,
    pendingParticipantsQuery,
    reviewerCountQuery,
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
    const navigate = useNavigate();
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
    // Unknown until the meeting has loaded, so nobody is treated as a plain
    // participant before their role is known.
    const isPlainParticipant = !!myParticipant && !isAdminOrCounter;
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
        // Admins and counters have tabs and switch on their own
        onMessage: () => {
            if (isPlainParticipant) setActiveTab('active');
        },
    });

    useLiveQuerySubscription(liveEvents.meetingVotationsUpdated(meetingId), {
        invalidate: [votationsQuery(meetingId), activeVotationQuery(meetingId)],
    });

    useLiveQuerySubscription(liveEvents.meetingUpdated(meetingId), {
        invalidate: [meetingQuery(meetingId)],
    });

    useLiveQuerySubscription(liveEvents.meetingDeleted(meetingId), {
        onMessage: () => {
            toast.info('Møtet er slettet');
            void navigate({ to: '/meetings' });
        },
    });

    // Role, voting eligibility or removal of the current user
    useLiveQuerySubscription(
        liveEvents.participantStatus(session.user.id, meetingId),
        {
            invalidate: [meetingQuery(meetingId)],
            onMessage: (status) => {
                if ('removed' in status) {
                    toast.info('Du er fjernet fra møtet');
                    void navigate({ to: '/meetings' });
                }
            },
        },
    );

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
                reviewerCountQuery(meetingId),
            ],
        },
    );

    // Participants have no tab bar: move them to the active tab when a
    // votation becomes active, and off staff-only tabs if they were demoted.
    // Admins and counters switch on their own.
    useEffect(() => {
        if (!isPlainParticipant) return;
        setActiveTab((current) => {
            if (current === 'active') return current;
            if (activeVotationId) return 'active';
            return 'votations';
        });
    }, [activeVotationId, isPlainParticipant]);

    if (!meeting) return null;

    return (
        <main className="mx-auto max-w-5xl px-4 py-8">
            <MeetingHeader
                meeting={meeting}
                meetingId={meetingId}
                isAdmin={!!isAdmin}
                isOwner={meeting.ownerId === session.user.id}
                isAdminOrCounter={isAdminOrCounter}
            />
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
    isOwner,
    isAdminOrCounter,
}: {
    meeting: MeetingData;
    meetingId: string;
    isAdmin: boolean;
    isOwner: boolean;
    isAdminOrCounter: boolean;
}) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const endMeeting = useMutation({
        mutationFn: () =>
            updateMeeting({ data: { meetingId, status: 'ENDED' } }),
        onSuccess: () => queryClient.invalidateQueries(meetingQuery(meetingId)),
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke oppdatere møtestatus'),
    });
    const [confirmEnd, setConfirmEnd] = useState(false);
    const removeMeeting = useMutation({
        mutationFn: () => deleteMeeting({ data: { meetingId } }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['meetings'] });
            void navigate({ to: '/meetings' });
        },
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke slette møtet'),
    });
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const deletePhrase = `Ja jeg vil slette ${meeting.title} med alle voteringer og resultater`;

    return (
        <div className="mb-6 flex flex-wrap items-center gap-3">
            {isAdmin ? (
                <EditableTitle title={meeting.title} meetingId={meetingId} />
            ) : (
                <h1 className="text-3xl font-bold text-foreground">
                    {meeting.title}
                </h1>
            )}
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
                    {isOwner && (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmDelete(true)}
                            disabled={removeMeeting.isPending}
                        >
                            Slett møte
                        </Button>
                    )}
                    <ConfirmDialog
                        open={confirmDelete}
                        onOpenChange={(open) => {
                            setConfirmDelete(open);
                            if (!open) setDeleteConfirmation('');
                        }}
                        title="Slette møtet?"
                        description={
                            <>
                                «{meeting.title}» med alle voteringer,
                                resultater og deltakere blir slettet for godt.
                                Dette kan ikke angres.
                            </>
                        }
                        confirmLabel="Slett møte"
                        actionVariant="destructive"
                        confirmDisabled={deleteConfirmation !== deletePhrase}
                        onConfirm={() => removeMeeting.mutate()}
                    >
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Skriv{' '}
                                <span className="font-medium text-foreground select-all">
                                    {deletePhrase}
                                </span>{' '}
                                for å bekrefte.
                            </p>
                            <Input
                                aria-label="Bekreftelsestekst"
                                value={deleteConfirmation}
                                onChange={(e) =>
                                    setDeleteConfirmation(e.target.value)
                                }
                                autoComplete="off"
                            />
                        </div>
                    </ConfirmDialog>
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

function EditableTitle({
    title,
    meetingId,
}: {
    title: string;
    meetingId: string;
}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    // null until the admin types, so an untouched editor follows live renames
    const [draft, setDraft] = useState<string | null>(null);
    const renameMeeting = useMutation({
        mutationFn: (newTitle: string) =>
            updateMeeting({ data: { meetingId, title: newTitle } }),
        onSuccess: async () => {
            await queryClient.invalidateQueries(meetingQuery(meetingId));
            setEditing(false);
        },
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke endre tittel'),
    });

    const startEditing = () => {
        setDraft(null);
        setEditing(true);
    };
    const cancel = () => {
        setDraft(null);
        setEditing(false);
    };
    const save = () => {
        if (draft === null) {
            setEditing(false);
            return;
        }
        const trimmed = draft.trim();
        if (!trimmed) {
            toast.error('Tittel kan ikke være tom');
            return;
        }
        if (trimmed === title) {
            setEditing(false);
            return;
        }
        renameMeeting.mutate(trimmed);
    };

    if (!editing) {
        return (
            <div className="flex items-center gap-1">
                <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Endre tittel"
                    onClick={startEditing}
                >
                    <Pencil />
                </Button>
            </div>
        );
    }

    return (
        <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            <Input
                autoFocus
                aria-label="Tittel"
                value={draft ?? title}
                maxLength={255}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') cancel();
                }}
                disabled={renameMeeting.isPending}
                className="h-10 w-72 text-xl font-bold md:text-xl"
            />
            <Button
                type="submit"
                size="icon-sm"
                variant="ghost"
                aria-label="Lagre tittel"
                disabled={renameMeeting.isPending}
            >
                <Check />
            </Button>
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Avbryt"
                onClick={cancel}
                disabled={renameMeeting.isPending}
            >
                <X />
            </Button>
        </form>
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
                    isAdmin={isAdmin}
                    isOwner={meeting.ownerId === userId}
                    pendingParticipants={pendingParticipants}
                />
            ) : null;
        case 'selfregistration':
            return isAdminOrCounter ? (
                <SelfRegistrationPanel
                    meetingId={meetingId}
                    isAdmin={isAdmin}
                    allowSelfRegistration={meeting.allowSelfRegistration}
                />
            ) : null;
        default:
            return null;
    }
}
