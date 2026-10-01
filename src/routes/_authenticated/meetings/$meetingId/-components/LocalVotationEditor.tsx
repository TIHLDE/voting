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
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { SortableVotationCard } from './SortableVotationCard';
import { VotationFormFields } from './VotationFormFields';
import { createEmptyVotation } from './votation-editor-types';
import type { VotationFormData } from './votation-editor-types';

export function LocalVotationEditor({
    votations,
    onChange,
}: {
    votations: VotationFormData[];
    onChange: (votations: VotationFormData[]) => void;
}) {
    const [openId, setOpenId] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor),
    );

    function addVotation() {
        const votation = createEmptyVotation();
        onChange([...votations, votation]);
        setOpenId(votation.id);
    }

    function updateVotation(id: string, patch: Partial<VotationFormData>) {
        onChange(
            votations.map((votation) =>
                votation.id === id ? { ...votation, ...patch } : votation,
            ),
        );
    }

    function duplicateVotation(source: VotationFormData) {
        const duplicate = {
            ...source,
            id: crypto.randomUUID(),
            alternatives: source.alternatives.map((alternative) => ({
                ...alternative,
                id: crypto.randomUUID(),
            })),
        };
        onChange([...votations, duplicate]);
        setOpenId(duplicate.id);
    }

    function handleDragEnd({ active, over }: DragEndEvent) {
        if (!over || active.id === over.id) return;
        const oldIndex = votations.findIndex(
            (votation) => votation.id === active.id,
        );
        const newIndex = votations.findIndex(
            (votation) => votation.id === over.id,
        );
        if (oldIndex !== -1 && newIndex !== -1) {
            onChange(arrayMove(votations, oldIndex, newIndex));
        }
    }

    return (
        <section className="space-y-4">
            <EditorHeader count={votations.length} onAdd={addVotation} />
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={votations.map((votation) => votation.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {votations.map((votation, index) => (
                        <SortableVotationCard
                            key={votation.id}
                            id={votation.id}
                            title={votation.title || `Votering ${index + 1}`}
                            type={votation.type}
                            open={openId === votation.id}
                            draggable
                            onOpenChange={(open) =>
                                setOpenId(open ? votation.id : null)
                            }
                        >
                            <div className="space-y-4 border-t p-4">
                                <VotationFormFields
                                    data={votation}
                                    onChange={(patch) =>
                                        updateVotation(votation.id, patch)
                                    }
                                />
                                <div className="flex gap-2 border-t pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            duplicateVotation(votation)
                                        }
                                    >
                                        <Copy className="mr-1 h-4 w-4" />
                                        Dupliser
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                            onChange(
                                                votations.filter(
                                                    (item) =>
                                                        item.id !== votation.id,
                                                ),
                                            );
                                            setOpenId(null);
                                        }}
                                    >
                                        <Trash2 className="mr-1 h-4 w-4" />
                                        Slett
                                    </Button>
                                </div>
                            </div>
                        </SortableVotationCard>
                    ))}
                </SortableContext>
            </DndContext>
            {votations.length === 0 && <EmptyVotations />}
        </section>
    );
}

export function EditorHeader({
    count,
    onAdd,
}: {
    count: number;
    onAdd: () => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
                Voteringer ({count})
            </h3>
            <Button type="button" size="sm" onClick={onAdd}>
                <Plus className="mr-1 h-4 w-4" />
                Ny votering
            </Button>
        </div>
    );
}

export function EmptyVotations() {
    return (
        <p className="py-8 text-center text-sm text-muted-foreground">
            Ingen voteringer ennå. Klikk &quot;Ny votering&quot; for å legge til
            en.
        </p>
    );
}
