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
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Copy, Save, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    createVotations,
    deleteVotation,
    getVotationsForMeeting,
    updateVotationIndexes,
    updateVotations,
} from '#/server/votations';
import { votationsQuery } from '#/queries/live';
import { Button } from '#/components/ui/button';
import { SortableVotationCard } from './SortableVotationCard';
import { VotationFormFields } from './VotationFormFields';
import { EditorHeader, EmptyVotations } from './LocalVotationEditor';
import { TYPE_LABELS, createEmptyVotation } from './votation-editor-types';
import type { VotationFormData } from './votation-editor-types';

type ServerVotation = Awaited<
    ReturnType<typeof getVotationsForMeeting>
>[number];

function toFormData(votation: ServerVotation): VotationFormData {
    return {
        id: votation.id,
        title: votation.title,
        description: votation.description ?? '',
        type: votation.type,
        blankVotes: votation.blankVotes,
        hiddenVotes: votation.hiddenVotes,
        numberOfWinners: votation.numberOfWinners,
        majorityThreshold: votation.majorityThreshold,
        alternatives: votation.alternatives.map((alternative) => ({
            id: alternative.id,
            text: alternative.text,
            index: alternative.index,
        })),
    };
}

function toServerInput(data: VotationFormData, index: number) {
    return {
        title: data.title,
        description: data.description,
        type: data.type,
        blankVotes: data.blankVotes,
        hiddenVotes: data.hiddenVotes,
        numberOfWinners: data.numberOfWinners,
        majorityThreshold: data.majorityThreshold,
        index,
        alternatives: data.alternatives.map(
            (alternative, alternativeIndex) => ({
                text: alternative.text,
                index: alternativeIndex,
            }),
        ),
    };
}

export function ServerVotationEditor({ meetingId }: { meetingId: string }) {
    const queryClient = useQueryClient();
    const { data: votations = [] } = useQuery(votationsQuery(meetingId));
    const [openId, setOpenId] = useState<string | null>(null);
    const [newVotation, setNewVotation] = useState<VotationFormData | null>(
        null,
    );
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor),
    );

    const reorderMutation = useMutation({
        mutationFn: (items: { id: string; index: number }[]) =>
            updateVotationIndexes({ data: { meetingId, votations: items } }),
        onSettled: () =>
            queryClient.invalidateQueries(votationsQuery(meetingId)),
    });

    const createMutation = useMutation({
        mutationFn: (data: VotationFormData) =>
            createVotations({
                data: {
                    meetingId,
                    votations: [toServerInput(data, votations.length)],
                },
            }),
        onSuccess: () => {
            setNewVotation(null);
            void queryClient.invalidateQueries(votationsQuery(meetingId));
            toast.success('Votering opprettet');
        },
        onError: showMutationError('Kunne ikke opprette'),
    });

    function handleDragEnd({ active, over }: DragEndEvent) {
        if (!over || active.id === over.id) return;
        const oldIndex = votations.findIndex(
            (votation) => votation.id === active.id,
        );
        const newIndex = votations.findIndex(
            (votation) => votation.id === over.id,
        );
        if (oldIndex === -1 || newIndex === -1) return;
        if (
            votations[oldIndex].status !== 'UPCOMING' ||
            votations[newIndex].status !== 'UPCOMING'
        ) {
            return;
        }

        reorderMutation.mutate(
            arrayMove(votations, oldIndex, newIndex).map((votation, index) => ({
                id: votation.id,
                index,
            })),
        );
    }

    return (
        <section className="space-y-4">
            <EditorHeader
                count={votations.length}
                onAdd={() => {
                    setNewVotation(createEmptyVotation());
                    setOpenId(null);
                }}
            />
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={votations.map((votation) => votation.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {votations.map((votation) => (
                        <ServerVotationItem
                            key={votation.id}
                            meetingId={meetingId}
                            votation={votation}
                            appendIndex={votations.length}
                            open={openId === votation.id}
                            onOpenChange={(open) =>
                                setOpenId(open ? votation.id : null)
                            }
                        />
                    ))}
                </SortableContext>
            </DndContext>
            {newVotation && (
                <NewVotationForm
                    data={newVotation}
                    pending={createMutation.isPending}
                    onChange={(patch) =>
                        setNewVotation((current) =>
                            current ? { ...current, ...patch } : current,
                        )
                    }
                    onCreate={() => createMutation.mutate(newVotation)}
                    onCancel={() => setNewVotation(null)}
                />
            )}
            {votations.length === 0 && !newVotation && <EmptyVotations />}
        </section>
    );
}

function ServerVotationItem({
    meetingId,
    votation,
    appendIndex,
    open,
    onOpenChange,
}: {
    meetingId: string;
    votation: ServerVotation;
    appendIndex: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const queryClient = useQueryClient();
    const [edits, setEdits] = useState<VotationFormData | null>(null);
    const formData = edits ?? toFormData(votation);
    const editable = votation.status === 'UPCOMING';

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

    const duplicateMutation = useMutation({
        mutationFn: () =>
            createVotations({
                data: {
                    meetingId,
                    votations: [toServerInput(formData, appendIndex)],
                },
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries(votationsQuery(meetingId));
            toast.success('Votering duplisert');
        },
        onError: showMutationError('Kunne ikke duplisere'),
    });

    return (
        <SortableVotationCard
            id={votation.id}
            title={votation.title}
            type={votation.type}
            status={editable ? undefined : votation.status}
            open={open}
            draggable={editable}
            onOpenChange={onOpenChange}
        >
            {editable ? (
                <div className="space-y-4 border-t p-4">
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
                        onDelete={() => {
                            if (window.confirm('Slett denne voteringen?')) {
                                deleteMutation.mutate();
                            }
                        }}
                        onDuplicate={() => duplicateMutation.mutate()}
                    />
                </div>
            ) : (
                <ReadOnlyVotation
                    votation={votation}
                    duplicating={duplicateMutation.isPending}
                    onDuplicate={() => duplicateMutation.mutate()}
                />
            )}
        </SortableVotationCard>
    );
}

function VotationActions({
    hasEdits,
    saving,
    deleting,
    duplicating,
    onSave,
    onDelete,
    onDuplicate,
}: {
    hasEdits: boolean;
    saving: boolean;
    deleting: boolean;
    duplicating: boolean;
    onSave: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
}) {
    return (
        <div className="flex gap-2 border-t pt-4">
            <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={!hasEdits || saving}
            >
                <Save className="mr-1 h-4 w-4" />
                {saving ? 'Lagrer...' : 'Lagre'}
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDuplicate}
                disabled={duplicating}
            >
                <Copy className="mr-1 h-4 w-4" />
                Dupliser
            </Button>
            <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleting}
            >
                <Trash2 className="mr-1 h-4 w-4" />
                Slett
            </Button>
        </div>
    );
}

function ReadOnlyVotation({
    votation,
    duplicating,
    onDuplicate,
}: {
    votation: ServerVotation;
    duplicating: boolean;
    onDuplicate: () => void;
}) {
    return (
        <div className="space-y-2 border-t p-4 text-sm text-muted-foreground">
            {votation.description && <p>{votation.description}</p>}
            <p>Type: {TYPE_LABELS[votation.type]}</p>
            {votation.alternatives.length > 0 && (
                <div>
                    <p className="font-medium text-foreground">Alternativer:</p>
                    <ul className="list-inside list-disc">
                        {votation.alternatives.map((alternative) => (
                            <li key={alternative.id}>
                                {alternative.text}
                                {alternative.isWinner ? ' (Vinner)' : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDuplicate}
                disabled={duplicating}
            >
                <Copy className="mr-1 h-4 w-4" />
                Dupliser
            </Button>
            <p className="text-xs italic">
                Kan ikke redigeres etter at votering er startet.
            </p>
        </div>
    );
}

function NewVotationForm({
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
        <div className="rounded-lg border-2 border-primary bg-card p-4">
            <h4 className="mb-4 font-semibold text-foreground">Ny votering</h4>
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

function showMutationError(fallback: string) {
    return (error: Error) => toast.error(error.message || fallback);
}
