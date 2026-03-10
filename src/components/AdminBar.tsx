import { Button } from '#/components/ui/button';

interface AdminBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: { id: string; label: string; badge?: number }[];
  onStartNextVotation?: () => void;
  startingVotation?: boolean;
}

export default function AdminBar({
  activeTab,
  onTabChange,
  tabs,
  onStartNextVotation,
  startingVotation,
}: AdminBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`relative rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            activeTab === tab.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
          {tab.badge != null && tab.badge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-white">
              {tab.badge}
            </span>
          )}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-2">
        {onStartNextVotation && (
          <Button size="sm" onClick={onStartNextVotation} disabled={startingVotation}>
            {startingVotation ? 'Starter...' : 'Start neste votering'}
          </Button>
        )}
      </div>
    </div>
  );
}
