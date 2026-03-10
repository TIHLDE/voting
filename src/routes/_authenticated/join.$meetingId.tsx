import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getMeetingPublicInfo } from '#/server/meetings.ts';
import {
    getMyRegistrationStatus,
    registerAsParticipant,
} from '#/server/participants.ts';
import { Button } from '#/components/ui/button';
import { useSSE } from '#/hooks/useSSE';

export const Route = createFileRoute('/_authenticated/join/$meetingId')({
    component: JoinMeeting,
});

function JoinMeeting() {
    const { meetingId } = Route.useParams();
    const { session } = Route.useRouteContext();
    const navigate = useNavigate();

    const { data: meetingInfo } = useQuery({
        queryKey: ['meetingPublicInfo', meetingId],
        queryFn: () => getMeetingPublicInfo({ data: { meetingId } }),
    });

    const { data: status, refetch } = useQuery({
        queryKey: ['registrationStatus', meetingId],
        queryFn: () => getMyRegistrationStatus({ data: { meetingId } }),
    });

    const registerMutation = useMutation({
        mutationFn: () => registerAsParticipant({ data: { meetingId } }),
        onSuccess: () => void refetch(),
    });

    useSSE(
        status?.status === 'pending'
            ? `participant:${session.user.id}:status:${meetingId}`
            : '',
        () => {
            void refetch().then((result) => {
                if (result.data?.status === 'approved') {
                    void navigate({
                        to: '/meetings/$meetingId',
                        params: { meetingId },
                    });
                }
            });
        },
    );

    if (status?.status === 'approved') {
        void navigate({ to: '/meetings/$meetingId', params: { meetingId } });
        return null;
    }

    if (status?.status === 'pending') {
        return (
            <main className="flex min-h-[60vh] items-center justify-center px-4">
                <div className="mx-auto max-w-md space-y-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-amber-500" />
                    </div>
                    {meetingInfo && (
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                {meetingInfo.title}
                            </h1>
                            <p className="mt-1 text-muted-foreground">
                                {meetingInfo.organization}
                            </p>
                        </div>
                    )}
                    <div className="rounded-xl border bg-card p-6">
                        <h2 className="text-lg font-semibold text-foreground">
                            Venter på godkjenning
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            En administrator må godkjenne forespørselen din før
                            du kan delta. Denne siden oppdateres automatisk.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    if (!meetingInfo) return null;

    if (!meetingInfo.allowSelfRegistration) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center px-4">
                <div className="mx-auto max-w-md space-y-4 text-center">
                    <h1 className="text-2xl font-bold text-foreground">
                        {meetingInfo.title}
                    </h1>
                    <p className="text-muted-foreground">
                        {meetingInfo.organization}
                    </p>
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
                        <p className="text-sm text-destructive">
                            Selvregistrering er ikke aktivert for dette møtet.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-[60vh] items-center justify-center px-4">
            <div className="mx-auto max-w-md space-y-6 text-center">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {meetingInfo.title}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        {meetingInfo.organization}
                    </p>
                    {meetingInfo.description && (
                        <p className="mt-3 text-sm text-muted-foreground">
                            {meetingInfo.description}
                        </p>
                    )}
                </div>
                <div className="rounded-xl border bg-card p-6">
                    <p className="mb-4 text-sm text-muted-foreground">
                        Du er logget inn som{' '}
                        <span className="font-medium text-foreground">
                            {session.user.name}
                        </span>
                        .
                    </p>
                    <Button
                        onClick={() => registerMutation.mutate()}
                        disabled={registerMutation.isPending}
                        size="lg"
                        className="w-full"
                    >
                        {registerMutation.isPending
                            ? 'Registrerer...'
                            : 'Be om tilgang'}
                    </Button>
                    {registerMutation.isError && (
                        <p className="mt-2 text-sm text-destructive">
                            {(registerMutation.error as Error).message}
                        </p>
                    )}
                </div>
            </div>
        </main>
    );
}
