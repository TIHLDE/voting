import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getMyMeetings } from '#/server/meetings.ts';
import MeetingCard from '#/components/MeetingCard';
import { buttonVariants } from '#/components/ui/button';
import { Skeleton } from '#/components/ui/skeleton';

export const Route = createFileRoute('/_authenticated/meetings/')({
  component: MeetingsDashboard,
});

function MeetingsDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => getMyMeetings(),
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Mine moter</h1>
        <Link to="/meetings/new" className={buttonVariants({ variant: 'default' }) + ' no-underline'}>
          Opprett mote
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <MeetingSection title="Pagaende" meetings={data?.ongoing ?? []} />
          <MeetingSection title="Kommende" meetings={data?.upcoming ?? []} />
          <MeetingSection title="Avsluttede" meetings={data?.ended ?? []} />
        </div>
      )}
    </main>
  );
}

function MeetingSection({
  title,
  meetings,
}: {
  title: string;
  meetings: Array<{
    id: string;
    title: string;
    organization: string;
    startTime: Date;
    status: 'UPCOMING' | 'ONGOING' | 'ENDED';
    myRole: string;
    isOwner: boolean;
  }>;
}) {
  if (meetings.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map((m) => (
          <MeetingCard key={m.id} {...m} />
        ))}
      </div>
    </section>
  );
}
