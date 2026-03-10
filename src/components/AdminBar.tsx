import { Button } from '#/components/ui/button';

interface AdminBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: { id: string; label: string }[];
  presentationMode: boolean;
  onTogglePresentationMode: () => void;
  onStartNextVotation?: () => void;
  startingVotation?: boolean;
}

export default function AdminBar({
  activeTab,
  onTabChange,
  tabs,
  presentationMode,
  onTogglePresentationMode,
  onStartNextVotation,
  startingVotation,
}: AdminBarProps) {
  if (presentationMode) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            activeTab === tab.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-2">
        {onStartNextVotation && (
          <Button size="sm" onClick={onStartNextVotation} disabled={startingVotation}>
            {startingVotation ? 'Starter...' : 'Start neste votering'}
          </Button>
        )}
        <button
          type="button"
          onClick={onTogglePresentationMode}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Presentasjonsmodus
        </button>
      </div>
    </div>
  );
}
