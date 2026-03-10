import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getMeetingById } from '#/server/meetings.ts';
import { Skeleton } from '#/components/ui/skeleton';

export const Route = createFileRoute('/_authenticated/meetings/$meetingId')({
    component: MeetingLayout,
});

function MeetingLayout() {
    const { meetingId } = Route.useParams();
    const { data: meeting, isLoading } = useQuery({
        queryKey: ['meeting', meetingId],
        queryFn: () => getMeetingById({ data: { meetingId } }),
    });

    if (isLoading) {
        return (
            <main className="mx-auto max-w-5xl px-4 py-12">
                <Skeleton className="mb-4 h-10 w-64" />
                <Skeleton className="h-96 rounded-xl" />
            </main>
        );
    }

    if (!meeting) {
        return (
            <main className="mx-auto max-w-5xl px-4 py-12">
                <p className="text-muted-foreground">Møtet finnes ikke.</p>
            </main>
        );
    }

    return <Outlet />;
}
