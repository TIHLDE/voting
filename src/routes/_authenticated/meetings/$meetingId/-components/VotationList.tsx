import { useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Copy, GripVertical, Plus } from 'lucide-react';
import ConfirmDialog from '#/components/ConfirmDialog';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { votationsQuery } from '#/queries/live';
import {
    createVotations,
    deleteVotation,
    updateVotationIndexes,
    updateVotations,
} from '#/server/votations';
import { VotationActions, VotationFormFields } from './VotationFormFields';
import {
    createEmptyVotation,
    toFormData,
    toServerInput,
} from './votation-editor-types';
import type { ServerVotation, VotationFormData } from './votation-editor-types';

interface VotationListProps {
    votations: ServerVotation[];
    meetingId: string;
    isAdmin: boolean;
    openVotationId: string | null;
    onViewActive: () => void;
}

const statusLabels: Record<string, string> = {
    UPCOMING: 'Kommende',
    OPEN: 'Åpen',
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
    const queryClient = useQueryClient();
    const sorted = [...votations].sort((a, b) => a.index - b.index);
    const upcoming = sorted.filter((v) => v.status === 'UPCOMING');
    const appendIndex = Math.max(-1, ...votations.map((v) => v.index)) + 1;
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor),
    );

    const reorderMutation = useMutation({
        mutationFn: (items: { id: string; index: number }[]) =>
            updateVotationIndexes({ data: { meetingId, votations: items } }),
        onMutate: async (items) => {
            const { queryKey } = votationsQuery(meetingId);
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData(queryKey);
            const indexById = new Map(items.map((i) => [i.id, i.index]));
            queryClient.setQueryData(queryKey, (current) =>
                current?.map((v) => ({
                    ...v,
                    index: indexById.get(v.id) ?? v.index,
                })),
            );
            return { previous };
        },
        onError: (err, _items, context) => {
            queryClient.setQueryData(
                votationsQuery(meetingId).queryKey,
                context?.previous,
            );
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke endre rekkefølge',
            );
        },
        onSettled: () =>
            queryClient.invalidateQueries(votationsQuery(meetingId)),
    });

    const [draft, setDraft] = useState<VotationFormData | null>(null);
    const createMutation = useMutation({
        mutationFn: (data: VotationFormData) =>
            createVotations({
                data: {
                    meetingId,
                    votations: [toServerInput(data, appendIndex)],
                },
            }),
        onSuccess: () => {
            setDraft(null);
            void queryClient.invalidateQueries(votationsQuery(meetingId));
            toast.success('Votering opprettet');
        },
        onError: showMutationError('Kunne ikke opprette'),
    });

    function handleDragEnd({ active, over }: DragEndEvent) {
        if (!over || active.id === over.id) return;
        const oldIndex = upcoming.findIndex((v) => v.id === active.id);
        const newIndex = upcoming.findIndex((v) => v.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        // Reuse the index slots the upcoming votations already occupy so
        // active and finished votations keep their positions.
        const slots = upcoming.map((v) => v.index);
        reorderMutation.mutate(
            arrayMove(upcoming, oldIndex, newIndex).map((v, i) => ({
                id: v.id,
                index: slots[i],
            })),
        );
    }

    return (
        <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
                Voteringer
            </h2>
            {votations.length === 0 && !draft && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    Ingen voteringer er opprettet for dette møtet ennå.
                </p>
            )}
            {votations.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={upcoming.map((v) => v.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {sorted.map((v) => {
                                if (v.status === 'OPEN') {
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={onViewActive}
                                            className="w-full rounded-xl border-2 border-primary bg-primary/5 p-4 text-left transition hover:bg-primary/10"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Badge variant="default">
                                                    Aktiv
                                                </Badge>
                                                <span className="font-semibold text-foreground">
                                                    {v.title}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                }

                                if (v.status === 'UPCOMING') {
                                    return (
                                        <VotationCard
                                            key={v.id}
                                            votation={v}
                                            meetingId={meetingId}
                                            isAdmin={isAdmin}
                                            appendIndex={appendIndex}
                                            badgeVariant="secondary"
                                            badgeLabel={statusLabels[v.status]}
                                        />
                                    );
                                }

                                return (
                                    <FinishedVotationCard
                                        key={v.id}
                                        votation={v}
                                        meetingId={meetingId}
                                        isAdmin={isAdmin}
                                        appendIndex={appendIndex}
                                    />
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
            {isAdmin && (
                <div className="mt-2">
                    {draft ? (
                        <NewVotationCard
                            data={draft}
                            pending={createMutation.isPending}
                            onChange={(patch) =>
                                setDraft((current) =>
                                    current
                                        ? { ...current, ...patch }
                                        : current,
                                )
                            }
                            onCreate={() => createMutation.mutate(draft)}
                            onCancel={() => setDraft(null)}
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setDraft(createEmptyVotation())}
                            className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed p-4 text-muted-foreground transition hover:border-primary hover:text-foreground"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="font-medium">Ny votering</span>
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}

function VotationCard({
    votation,
    meetingId,
    isAdmin,
    appendIndex,
    badgeVariant,
    badgeLabel,
}: {
    votation: ServerVotation;
    meetingId: string;
    isAdmin: boolean;
    appendIndex: number;
    badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    badgeLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const [edits, setEdits] = useState<VotationFormData | null>(null);
    const formData = edits ?? toFormData(votation);
    const queryClient = useQueryClient();

    const saveMutation = useMutation({
        mutationFn: () =>
            updateVotations({
                data: {
                    meetingId,
                    votations: [
                        {
                            id: votation.id,
                            ...toServerInput(formData, votation.index),
                        },
                    ],
                },
            }),
        onSuccess: () => {
            setEdits(null);
            void queryClient.invalidateQueries(votationsQuery(meetingId));
            toast.success('Votering lagret');
        },
        onError: showMutationError('Kunne ikke lagre'),
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteVotation({ data: { votationId: votation.id } }),
        onSuccess: () => {
            void queryClient.invalidateQueries(votationsQuery(meetingId));
            toast.success('Votering slettet');
        },
        onError: showMutationError('Kunne ikke slette'),
    });

    const duplicateMutation = useDuplicateVotation(meetingId, appendIndex);
    const [confirmDuplicate, setConfirmDuplicate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const canEdit = isAdmin && votation.status === 'UPCOMING';
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: votation.id, disabled: !canEdit });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
                opacity: isDragging ? 0.5 : 1,
                position: 'relative',
                zIndex: isDragging ? 10 : undefined,
            }}
            className="space-y-3 rounded-xl border border-card-border bg-card p-4"
        >
            <div className="flex items-center gap-2">
                {canEdit && (
                    <button
                        type="button"
                        aria-label="Endre rekkefølge"
                        className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                )}
                <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                <span className="font-medium text-foreground">
                    {votation.title}
                </span>
                {canEdit && (
                    <button
                        type="button"
                        aria-label={
                            open ? 'Skjul redigering' : 'Rediger votering'
                        }
                        aria-expanded={open}
                        onClick={() => setOpen((current) => !current)}
                        className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={open ? 'Skjul redigering' : 'Rediger votering'}
                    >
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                    </button>
                )}
            </div>
            {canEdit && open && (
                <div className="space-y-4">
                    <VotationFormFields
                        data={formData}
                        onChange={(patch) =>
                            setEdits((current) => ({
                                ...(current ?? toFormData(votation)),
                                ...patch,
                            }))
                        }
                    />
                    <VotationActions
                        hasEdits={edits !== null}
                        saving={saveMutation.isPending}
                        deleting={deleteMutation.isPending}
                        duplicating={duplicateMutation.isPending}
                        onSave={() => saveMutation.mutate()}
                        onDelete={() => setConfirmDelete(true)}
                        onDuplicate={() => setConfirmDuplicate(true)}
                    />
                </div>
            )}
            <ConfirmDialog
                open={confirmDuplicate}
                onOpenChange={setConfirmDuplicate}
                title="Dupliser votering?"
                description={
                    <>
                        «{formData.title}» blir kopiert og lagt til nederst i
                        listen som en ny kommende votering.
                        {edits !== null &&
                            ' Ulagrede endringer blir med i kopien, men lagres ikke på originalen.'}
                    </>
                }
                confirmLabel="Dupliser"
                onConfirm={() => duplicateMutation.mutate(formData)}
            />
            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Slett votering?"
                description={
                    <>
                        «{votation.title}» og alle alternativene blir slettet
                        for godt. Dette kan ikke angres.
                    </>
                }
                confirmLabel="Slett"
                actionVariant="destructive"
                onConfirm={() => deleteMutation.mutate()}
            />
        </div>
    );
}

function FinishedVotationCard({
    votation,
    meetingId,
    isAdmin,
    appendIndex,
}: {
    votation: ServerVotation;
    meetingId: string;
    isAdmin: boolean;
    appendIndex: number;
}) {
    const duplicateMutation = useDuplicateVotation(meetingId, appendIndex);
    const [confirmDuplicate, setConfirmDuplicate] = useState(false);
    const winners = votation.alternatives.filter((a) => a.isWinner);

    return (
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card/50 p-4">
            <div className="flex flex-1 items-center gap-2 opacity-60">
                <Badge
                    variant={
                        statusColors[votation.status] as
                            | 'default'
                            | 'secondary'
                            | 'outline'
                            | 'destructive'
                    }
                >
                    {statusLabels[votation.status]}
                </Badge>
                <span className="font-medium text-muted-foreground">
                    {votation.title}
                </span>
                {winners.length > 0 && (
                    <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400">
                        Vinner: {winners.map((w) => w.text).join(', ')}
                    </span>
                )}
            </div>
            {isAdmin && (
                <button
                    type="button"
                    aria-label="Dupliser votering"
                    title="Dupliser votering"
                    onClick={() => setConfirmDuplicate(true)}
                    disabled={duplicateMutation.isPending}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                    <Copy className="h-4 w-4" />
                </button>
            )}
            <ConfirmDialog
                open={confirmDuplicate}
                onOpenChange={setConfirmDuplicate}
                title="Dupliser votering?"
                description={
                    <>
                        «{votation.title}» blir kopiert og lagt til nederst i
                        listen som en ny kommende votering.
                    </>
                }
                confirmLabel="Dupliser"
                onConfirm={() => duplicateMutation.mutate(toFormData(votation))}
            />
        </div>
    );
}

function NewVotationCard({
    data,
    pending,
    onChange,
    onCreate,
    onCancel,
}: {
    data: VotationFormData;
    pending: boolean;
    onChange: (patch: Partial<VotationFormData>) => void;
    onCreate: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="space-y-3 rounded-xl border border-card-border bg-card p-4">
            <div className="flex items-center gap-2">
                <Badge variant="outline">Ny</Badge>
                <span className="font-medium text-foreground">
                    {data.title || 'Ny votering'}
                </span>
            </div>
            <div className="space-y-4">
                <VotationFormFields data={data} onChange={onChange} />
                <div className="flex gap-2 border-t pt-4">
                    <Button
                        type="button"
                        size="sm"
                        onClick={onCreate}
                        disabled={!data.title || pending}
                    >
                        {pending ? 'Oppretter...' : 'Opprett'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                    >
                        Avbryt
                    </Button>
                </div>
            </div>
        </div>
    );
}

function useDuplicateVotation(meetingId: string, appendIndex: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: VotationFormData) =>
            createVotations({
                data: {
                    meetingId,
                    votations: [toServerInput(data, appendIndex)],
                },
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries(votationsQuery(meetingId));
            toast.success('Votering duplisert');
        },
        onError: showMutationError('Kunne ikke duplisere'),
    });
}

function showMutationError(fallback: string) {
    return (error: Error) => toast.error(error.message || fallback);
}
