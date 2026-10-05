import { Button } from '#/components/ui/button';
import { approveParticipant, denyParticipant } from '#/server/participants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ManageParticipants from '../-components/ManageParticipants';

export function ParticipantsPanel({
    meetingId,
    isAdmin,
    pendingParticipants,
}: {
    meetingId: string;
    isAdmin: boolean;
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

            <ManageParticipants meetingId={meetingId} isAdmin={isAdmin} />
        </div>
    );
}
