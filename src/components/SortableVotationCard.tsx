import { ChevronDown, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '#/components/ui/badge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '#/components/ui/collapsible';
import { STATUS_LABELS, TYPE_LABELS } from './votation-editor-types';
import type { VotationFormData } from './votation-editor-types';

export function SortableVotationCard({
    id,
    title,
    type,
    status,
    open,
    draggable,
    onOpenChange,
    children,
}: {
    id: string;
    title: string;
    type: VotationFormData['type'];
    status?: string;
    open: boolean;
    draggable: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled: !draggable });

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
        >
            <Collapsible open={open} onOpenChange={onOpenChange}>
                <div className="rounded-lg border bg-card">
                    <div className="flex items-center">
                        <button
                            type="button"
                            aria-label="Endre rekkefølge"
                            className={`touch-none p-4 ${
                                draggable
                                    ? 'cursor-grab text-muted-foreground hover:text-foreground'
                                    : 'cursor-default text-muted-foreground/30'
                            }`}
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                        <CollapsibleTrigger className="flex flex-1 items-center gap-3 py-4 pr-4 text-left">
                            <span className="flex-1 font-medium text-foreground">
                                {title}
                            </span>
                            {status && (
                                <Badge variant="secondary" className="text-xs">
                                    {STATUS_LABELS[status] ?? status}
                                </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                                {TYPE_LABELS[type]}
                            </span>
                            <ChevronDown
                                className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                            />
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>{children}</CollapsibleContent>
                </div>
            </Collapsible>
        </div>
    );
}
