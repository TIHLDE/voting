import { Badge } from '#/components/ui/badge';

interface VotationItem {
  id: string;
  title: string;
  status: string;
  type: string;
  index: number;
  alternatives: Array<{ id: string; text: string; isWinner: boolean }>;
}

interface VotationListProps {
  votations: VotationItem[];
  meetingId: string;
  isAdmin: boolean;
  openVotationId: string | null;
  onViewActive: () => void;
}

const statusLabels: Record<string, string> = {
  UPCOMING: 'Kommende',
  OPEN: 'Apen',
  CHECKING_RESULT: 'Kontrolleres',
  PUBLISHED_RESULT: 'Publisert',
  INVALID: 'Ugyldig',
};

const statusColors: Record<string, string> = {
  UPCOMING: 'secondary',
  OPEN: 'default',
  CHECKING_RESULT: 'outline',
  PUBLISHED_RESULT: 'secondary',
  INVALID: 'destructive',
};

export default function VotationList({ votations, onViewActive }: VotationListProps) {
  const active = votations.filter((v) => v.status === 'OPEN');
  const upcoming = votations.filter((v) => v.status === 'UPCOMING');
  const ended = votations.filter(
    (v) => v.status === 'PUBLISHED_RESULT' || v.status === 'CHECKING_RESULT' || v.status === 'INVALID',
  );

  const nextVotation = upcoming[0];

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Aktiv votering</h2>
          {active.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={onViewActive}
              className="w-full rounded-xl border-2 border-primary bg-primary/5 p-4 text-left transition hover:bg-primary/10"
            >
              <div className="flex items-center gap-2">
                <Badge variant="default">Aktiv</Badge>
                <span className="font-semibold text-foreground">{v.title}</span>
              </div>
            </button>
          ))}
        </section>
      )}

      {nextVotation && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Neste votering</h2>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Neste</Badge>
              <span className="font-medium text-foreground">{nextVotation.title}</span>
            </div>
          </div>
        </section>
      )}

      {upcoming.length > 1 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Kommende ({upcoming.length - 1})</h2>
          <div className="space-y-2">
            {upcoming.slice(1).map((v) => (
              <div key={v.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={statusColors[v.status] as 'default' | 'secondary' | 'outline' | 'destructive'}>
                    {statusLabels[v.status]}
                  </Badge>
                  <span className="text-sm text-foreground">{v.title}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Avsluttede ({ended.length})</h2>
          <div className="space-y-2">
            {ended.map((v) => {
              const winners = v.alternatives.filter((a) => a.isWinner);
              return (
                <div key={v.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColors[v.status] as 'default' | 'secondary' | 'outline' | 'destructive'}>
                      {statusLabels[v.status]}
                    </Badge>
                    <span className="text-sm text-foreground">{v.title}</span>
                    {winners.length > 0 && (
                      <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400">
                        Vinner: {winners.map((w) => w.text).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {votations.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ingen voteringer er opprettet for dette møtet enna.
        </p>
      )}
    </div>
  );
}
