import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, X, Check } from 'lucide-react';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { updateVotations } from '#/server/votations.ts';

interface VotationItem {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    type: string;
    blankVotes: boolean;
    hiddenVotes: boolean;
    numberOfWinners: number;
    majorityThreshold: number;
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

export default function VotationList({
    votations,
    meetingId,
    isAdmin,
    onViewActive,
}: VotationListProps) {
    const active = votations.filter((v) => v.status === 'OPEN');
    const upcoming = votations.filter((v) => v.status === 'UPCOMING');
    const ended = votations.filter(
        (v) =>
            v.status === 'PUBLISHED_RESULT' ||
            v.status === 'CHECKING_RESULT' ||
            v.status === 'INVALID',
    );

    const nextVotation = upcoming[0];

    return (
        <div className="space-y-6">
            {active.length > 0 && (
                <section>
                    <h2 className="mb-3 text-lg font-semibold text-foreground">
                        Aktiv votering
                    </h2>
                    {active.map((v) => (
                        <button
                            key={v.id}
                            type="button"
                            onClick={onViewActive}
                            className="w-full rounded-xl border-2 border-primary bg-primary/5 p-4 text-left transition hover:bg-primary/10"
                        >
                            <div className="flex items-center gap-2">
                                <Badge variant="default">Aktiv</Badge>
                                <span className="font-semibold text-foreground">
                                    {v.title}
                                </span>
                            </div>
                        </button>
                    ))}
                </section>
            )}

            {nextVotation && (
                <section>
                    <h2 className="mb-3 text-lg font-semibold text-foreground">
                        Neste votering
                    </h2>
                    <VotationCard
                        votation={nextVotation}
                        meetingId={meetingId}
                        isAdmin={isAdmin}
                        badgeVariant="secondary"
                        badgeLabel="Neste"
                    />
                </section>
            )}

            {upcoming.length > 1 && (
                <section>
                    <h2 className="mb-3 text-lg font-semibold text-foreground">
                        Kommende ({upcoming.length - 1})
                    </h2>
                    <div className="space-y-2">
                        {upcoming.slice(1).map((v) => (
                            <VotationCard
                                key={v.id}
                                votation={v}
                                meetingId={meetingId}
                                isAdmin={isAdmin}
                                badgeVariant={
                                    statusColors[v.status] as
                                        | 'default'
                                        | 'secondary'
                                        | 'outline'
                                        | 'destructive'
                                }
                                badgeLabel={statusLabels[v.status]}
                            />
                        ))}
                    </div>
                </section>
            )}

            {ended.length > 0 && (
                <section>
                    <h2 className="mb-3 text-lg font-semibold text-foreground">
                        Avsluttede ({ended.length})
                    </h2>
                    <div className="space-y-2">
                        {ended.map((v) => {
                            const winners = v.alternatives.filter(
                                (a) => a.isWinner,
                            );
                            return (
                                <div
                                    key={v.id}
                                    className="rounded-lg border bg-card p-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={
                                                statusColors[v.status] as
                                                    | 'default'
                                                    | 'secondary'
                                                    | 'outline'
                                                    | 'destructive'
                                            }
                                        >
                                            {statusLabels[v.status]}
                                        </Badge>
                                        <span className="text-sm text-foreground">
                                            {v.title}
                                        </span>
                                        {winners.length > 0 && (
                                            <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400">
                                                Vinner:{' '}
                                                {winners
                                                    .map((w) => w.text)
                                                    .join(', ')}
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

function VotationCard({
    votation,
    meetingId,
    isAdmin,
    badgeVariant,
    badgeLabel,
}: {
    votation: VotationItem;
    meetingId: string;
    isAdmin: boolean;
    badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    badgeLabel: string;
}) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(votation.title);
    const [description, setDescription] = useState(votation.description ?? '');
    const [alternatives, setAlternatives] = useState(
        votation.alternatives.map((a) => ({ id: a.id, text: a.text })),
    );
    const queryClient = useQueryClient();

    const editMutation = useMutation({
        mutationFn: () =>
            updateVotations({
                data: {
                    meetingId,
                    votations: [
                        {
                            id: votation.id,
                            title,
                            description: description || undefined,
                            type: votation.type as
                                | 'SIMPLE'
                                | 'QUALIFIED'
                                | 'STV',
                            blankVotes: votation.blankVotes,
                            hiddenVotes: votation.hiddenVotes,
                            numberOfWinners: votation.numberOfWinners,
                            majorityThreshold: votation.majorityThreshold,
                            index: votation.index,
                            alternatives: alternatives.map((a, i) => ({
                                id: a.id,
                                text: a.text,
                                index: i,
                            })),
                        },
                    ],
                },
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['votations', meetingId],
            });
            setEditing(false);
            toast.success('Votering oppdatert');
        },
        onError: (err) => {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke oppdatere votering',
            );
        },
    });

    const canEdit = isAdmin && votation.status === 'UPCOMING';

    if (editing) {
        return (
            <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                    <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => editMutation.mutate()}
                            disabled={editMutation.isPending}
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setTitle(votation.title);
                                setDescription(votation.description ?? '');
                                setAlternatives(
                                    votation.alternatives.map((a) => ({
                                        id: a.id,
                                        text: a.text,
                                    })),
                                );
                                setEditing(false);
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
                    placeholder="Tittel"
                />
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="Beskrivelse (valgfritt)"
                />
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                        Alternativer
                    </p>
                    {alternatives.map((alt, i) => (
                        <div key={alt.id} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={alt.text}
                                onChange={(e) => {
                                    const updated = [...alternatives];
                                    updated[i] = {
                                        ...updated[i],
                                        text: e.target.value,
                                    };
                                    setAlternatives(updated);
                                }}
                                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setAlternatives(
                                        alternatives.filter(
                                            (_, idx) => idx !== i,
                                        ),
                                    )
                                }
                                className="text-xs text-destructive hover:underline"
                            >
                                Fjern
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() =>
                            setAlternatives([
                                ...alternatives,
                                { id: '', text: '' },
                            ])
                        }
                        className="text-xs text-primary hover:underline"
                    >
                        + Legg til alternativ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
                <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                <span className="font-medium text-foreground">
                    {votation.title}
                </span>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Rediger votering"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
