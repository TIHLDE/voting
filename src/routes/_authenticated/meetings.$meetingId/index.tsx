import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { getMeetingById, updateMeeting } from '#/server/meetings.ts';
import { getVotationsForMeeting } from '#/server/votations.ts';
import { getOpenVotation, startNextVotation } from '#/server/voting.ts';
import AdminBar from '#/components/AdminBar';
import VotationList from '#/components/VotationList';
import ActiveVotation from '#/components/ActiveVotation';
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
  const [presentationMode, setPresentationMode] = useState(false);

  const { data: meeting } = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: () => getMeetingById({ data: { meetingId } }),
  });

  const { data: votations } = useQuery({
    queryKey: ['votations', meetingId],
    queryFn: () => getVotationsForMeeting({ data: { meetingId } }),
  });

  const { data: openVotationId } = useQuery({
    queryKey: ['openVotation', meetingId],
    queryFn: () => getOpenVotation({ data: { meetingId } }),
  });

  const isAdmin = meeting?.participants?.some((p) => p.userId === session.user.id && p.role === 'ADMIN');

  useWsSubscription(`meeting:${meetingId}:votation-opened`, {
    invalidate: [
      ['openVotation', meetingId],
      ['votations', meetingId],
    ],
    onMessage: () => setActiveTab('active'),
  });

  useWsSubscription(`meeting:${meetingId}:votations-updated`, {
    invalidate: [['votations', meetingId]],
  });

  const startMutation = useMutation({
    mutationFn: () => startNextVotation({ data: { meetingId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['openVotation', meetingId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['votations', meetingId],
      });
      setActiveTab('active');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'ONGOING' | 'ENDED') => updateMeeting({ data: { meetingId, status } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });

  if (!meeting) return null;

  const adminTabs = [
    { id: 'votations', label: 'Voteringer' },
    { id: 'active', label: 'Aktiv votering' },
    { id: 'selfregistration', label: 'Selvregistrering' },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-foreground">{meeting.title}</h1>
        <StatusBadge status={meeting.status} />
        {isAdmin && !presentationMode && (
          <div className="ml-auto flex gap-2">
            {meeting.status === 'UPCOMING' && (
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('ONGOING')}>
                Start møte
              </Button>
            )}
            {meeting.status === 'ONGOING' && (
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('ENDED')}>
                Avslutt møte
              </Button>
            )}
            <Link to="/meetings/$meetingId/edit" params={{ meetingId }}>
              <Button size="sm" variant="outline">
                Rediger
              </Button>
            </Link>
          </div>
        )}
      </div>

      {meeting.description && <p className="mb-6 text-muted-foreground">{meeting.description}</p>}

      {isAdmin && (
        <AdminBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={adminTabs}
          presentationMode={presentationMode}
          onTogglePresentationMode={() => setPresentationMode(!presentationMode)}
          onStartNextVotation={() => startMutation.mutate()}
          startingVotation={startMutation.isPending}
        />
      )}

      {activeTab === 'votations' && (
        <VotationList
          votations={votations ?? []}
          meetingId={meetingId}
          isAdmin={!!isAdmin}
          openVotationId={openVotationId ?? null}
          onViewActive={() => setActiveTab('active')}
        />
      )}

      {activeTab === 'active' && (
        <ActiveVotation meetingId={meetingId} openVotationId={openVotationId ?? null} isAdmin={!!isAdmin} />
      )}

      {activeTab === 'selfregistration' && isAdmin && (
        <SelfRegistrationPanel meetingId={meetingId} allowSelfRegistration={meeting.allowSelfRegistration} />
      )}
    </main>
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
          Selvregistrering er ikke aktivert for dette møtet. Du kan aktivere det i møteinnstillingene.
        </p>
      </div>
    );
  }

  const regUrl = typeof window !== 'undefined' ? `${window.location.origin}/meetings/${meetingId}/register` : '';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Selvregistrering</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Del denne lenken eller QR-koden med deltakere som skal registrere seg selv.
      </p>
      <div className="mb-4 flex items-center gap-2">
        <code className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm">{regUrl}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(regUrl);
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
  const url = typeof window !== 'undefined' ? `${window.location.origin}/meetings/${meetingId}/register` : '';

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

  if (!QRCodeSVG) return <div className="h-[200px] w-[200px] animate-pulse rounded bg-muted" />;

  return <QRCodeSVG value={value} size={200} />;
}
