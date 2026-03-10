import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVoteAudit } from '#/server/voting.ts';
import { ChevronDown } from 'lucide-react';

export default function VoteAudit({ votationId }: { votationId: string }) {
    const { data: audit } = useQuery({
        queryKey: ['voteAudit', votationId],
        queryFn: () => getVoteAudit({ data: { votationId } }),
    });

    if (!audit) return null;

    return (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <h4 className="text-sm font-semibold text-foreground">
                Stemmedetaljer (kun synlig for admin)
            </h4>

            <CollapsibleSection title={`Hvem har stemt (${audit.totalVoters})`}>
                <div className="space-y-1">
                    {audit.voters.map((v, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm"
                        >
                            <span>{v.name}</span>
                            <span className="text-muted-foreground">
                                {v.email}
                            </span>
                        </div>
                    ))}
                    {audit.voters.length === 0 && (
                        <p className="text-sm italic text-muted-foreground">
                            Ingen har stemt ennå.
                        </p>
                    )}
                </div>
            </CollapsibleSection>

            {audit.blankVoteCount > 0 && (
                <p className="text-sm text-muted-foreground">
                    Blanke stemmer: {audit.blankVoteCount}
                </p>
            )}

            {audit.type === 'STV' && audit.ballots.length > 0 && (
                <CollapsibleSection
                    title={`Anonyme stemmesedler (${audit.ballots.length})`}
                >
                    <div className="space-y-2">
                        {audit.ballots.map((ballot, i) => (
                            <div
                                key={ballot.id}
                                className="rounded border bg-background p-3 text-sm"
                            >
                                <span className="font-medium">
                                    Seddel {i + 1}:
                                </span>
                                {ballot.rankings.length > 0 ? (
                                    <ol className="ml-4 list-decimal">
                                        {ballot.rankings.map((r) => (
                                            <li key={r.ranking}>
                                                {r.alternativeText}
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <span className="ml-2 italic text-muted-foreground">
                                        Blank
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>
            )}
        </div>
    );
}

function CollapsibleSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button
                type="button"
                className="flex w-full items-center gap-2 text-sm font-semibold text-foreground"
                onClick={() => setOpen(!open)}
            >
                <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                />
                {title}
            </button>
            {open && <div className="mt-2">{children}</div>}
        </div>
    );
}
