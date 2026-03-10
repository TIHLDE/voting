import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    getVotationsForMeeting,
    updateVotations,
    deleteVotation,
    createVotations,
} from '#/server/votations.ts';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Textarea } from '#/components/ui/textarea';
import { Switch } from '#/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '#/components/ui/collapsible';
import { Badge } from '#/components/ui/badge';
import {
    ChevronDown,
    GripVertical,
    Plus,
    Trash2,
    Copy,
    Save,
} from 'lucide-react';

export interface VotationFormData {
    title: string;
    description?: string;
    type: 'SIMPLE' | 'QUALIFIED' | 'STV';
    blankVotes: boolean;
    hiddenVotes: boolean;
    numberOfWinners: number;
    majorityThreshold: number;
    alternatives: { text: string; index: number }[];
}

interface VotationEditorProps {
    meetingId?: string;
    votations?: VotationFormData[];
    onChange?: (votations: VotationFormData[]) => void;
}

const defaultVotation: VotationFormData = {
    title: '',
    type: 'SIMPLE',
    blankVotes: false,
    hiddenVotes: false,
    numberOfWinners: 1,
    majorityThreshold: 50,
    alternatives: [],
};

const TYPE_LABELS: Record<string, string> = {
    SIMPLE: 'Simpelt flertall',
    QUALIFIED: 'Kvalifisert flertall',
    STV: 'Preferansevalg (STV)',
};

const STATUS_LABELS: Record<string, string> = {
    OPEN: 'Åpen',
    CHECKING_RESULT: 'Kontrolleres',
    PUBLISHED_RESULT: 'Publisert',
    INVALID: 'Ugyldig',
};

function serverToFormData(v: any): VotationFormData {
    return {
        title: v.title,
        description: v.description ?? '',
        type: v.type,
        blankVotes: v.blankVotes,
        hiddenVotes: v.hiddenVotes,
        numberOfWinners: v.numberOfWinners,
        majorityThreshold: v.majorityThreshold,
        alternatives: (v.alternatives ?? []).map((a: any) => ({
            text: a.text,
            index: a.index,
        })),
    };
}

export default function VotationEditor({
    meetingId,
    votations: localVotations,
    onChange,
}: VotationEditorProps) {
    const isLocal = !meetingId;
    const queryClient = useQueryClient();

    const { data: serverVotations } = useQuery({
        queryKey: ['votations', meetingId],
        queryFn: () =>
            getVotationsForMeeting({ data: { meetingId: meetingId! } }),
        enabled: !!meetingId,
    });

    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [serverEdits, setServerEdits] = useState<
        Record<string, VotationFormData>
    >({});
    const [newVotation, setNewVotation] = useState<VotationFormData | null>(
        null,
    );

    const displayVotations = isLocal
        ? (localVotations ?? [])
        : (serverVotations ?? []);

    function getFormData(v: any): VotationFormData {
        if (isLocal) return v as VotationFormData;
        return serverEdits[v.id] ?? serverToFormData(v);
    }

    function updateFormData(index: number, patch: Partial<VotationFormData>) {
        if (isLocal) {
            const updated = [...(localVotations ?? [])];
            updated[index] = { ...updated[index], ...patch };
            onChange?.(updated);
            return;
        }
        const sv = (serverVotations as any[])[index];
        const current = serverEdits[sv.id] ?? serverToFormData(sv);
        setServerEdits((prev) => ({
            ...prev,
            [sv.id]: { ...current, ...patch },
        }));
    }

    function addVotation() {
        if (isLocal) {
            onChange?.([...(localVotations ?? []), { ...defaultVotation }]);
            setOpenIndex((localVotations ?? []).length);
        } else {
            setNewVotation({ ...defaultVotation });
            setOpenIndex(null);
        }
    }

    function removeVotation(index: number) {
        if (!isLocal) return;
        const updated = (localVotations ?? []).filter((_, i) => i !== index);
        onChange?.(updated);
        setOpenIndex(null);
    }

    function duplicateVotation(index: number) {
        if (!isLocal) return;
        const votations = localVotations ?? [];
        const dup = {
            ...votations[index],
            alternatives: [...votations[index].alternatives],
        };
        onChange?.([...votations, dup]);
    }

    const saveMutation = useMutation({
        mutationFn: (votationId: string) => {
            const editData = serverEdits[votationId];
            if (!editData) throw new Error('Ingen endringer');
            const sv = (serverVotations as any[])!.find(
                (v: any) => v.id === votationId,
            );
            return updateVotations({
                data: {
                    meetingId: meetingId!,
                    votations: [
                        {
                            id: votationId,
                            title: editData.title,
                            description: editData.description,
                            type: editData.type,
                            blankVotes: editData.blankVotes,
                            hiddenVotes: editData.hiddenVotes,
                            numberOfWinners: editData.numberOfWinners,
                            majorityThreshold: editData.majorityThreshold,
                            index: sv!.index,
                            alternatives: editData.alternatives.map((a, i) => ({
                                text: a.text,
                                index: i,
                            })),
                        },
                    ],
                },
            });
        },
        onSuccess: (_, votationId) => {
            void queryClient.invalidateQueries({
                queryKey: ['votations', meetingId],
            });
            setServerEdits((prev) => {
                const next = { ...prev };
                delete next[votationId];
                return next;
            });
            toast.success('Votering lagret');
        },
        onError: (err) => {
            toast.error(
                err instanceof Error ? err.message : 'Kunne ikke lagre',
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (votationId: string) =>
            deleteVotation({ data: { votationId } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['votations', meetingId],
            });
            setOpenIndex(null);
            toast.success('Votering slettet');
        },
        onError: (err) => {
            toast.error(
                err instanceof Error ? err.message : 'Kunne ikke slette',
            );
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: VotationFormData) =>
            createVotations({
                data: {
                    meetingId: meetingId!,
                    votations: [
                        {
                            title: data.title,
                            description: data.description,
                            type: data.type,
                            blankVotes: data.blankVotes,
                            hiddenVotes: data.hiddenVotes,
                            numberOfWinners: data.numberOfWinners,
                            majorityThreshold: data.majorityThreshold,
                            index: displayVotations.length,
                            alternatives: data.alternatives.map((a, i) => ({
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
            setNewVotation(null);
            toast.success('Votering opprettet');
        },
        onError: (err) => {
            toast.error(
                err instanceof Error ? err.message : 'Kunne ikke opprette',
            );
        },
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                    Voteringer ({displayVotations.length})
                </h3>
                <Button type="button" size="sm" onClick={addVotation}>
                    <Plus className="mr-1 h-4 w-4" />
                    Ny votering
                </Button>
            </div>

            {displayVotations.map((v: any, index: number) => {
                const isOpen = openIndex === index;
                const votationData = getFormData(v);
                const isEditable = isLocal || v.status === 'UPCOMING';
                const hasEdits = !isLocal && !!serverEdits[v.id];

                return (
                    <Collapsible
                        key={isLocal ? index : v.id}
                        open={isOpen}
                        onOpenChange={(open) =>
                            setOpenIndex(open ? index : null)
                        }
                    >
                        <div className="rounded-lg border bg-card">
                            <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="flex-1 font-medium text-foreground">
                                    {v.title || `Votering ${index + 1}`}
                                </span>
                                {!isLocal && !isEditable && (
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                    >
                                        {STATUS_LABELS[v.status] ?? v.status}
                                    </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                    {TYPE_LABELS[v.type] ?? v.type}
                                </span>
                                <ChevronDown
                                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                />
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                {isEditable ? (
                                    <div className="space-y-4 border-t p-4">
                                        <VotationFormFields
                                            data={votationData}
                                            onChange={(patch) =>
                                                updateFormData(index, patch)
                                            }
                                        />
                                        <div className="flex gap-2 border-t pt-4">
                                            {!isLocal && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            saveMutation.mutate(
                                                                v.id,
                                                            )
                                                        }
                                                        disabled={
                                                            !hasEdits ||
                                                            saveMutation.isPending
                                                        }
                                                    >
                                                        <Save className="mr-1 h-4 w-4" />
                                                        {saveMutation.isPending
                                                            ? 'Lagrer...'
                                                            : 'Lagre'}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (
                                                                window.confirm(
                                                                    'Slett denne voteringen?',
                                                                )
                                                            ) {
                                                                deleteMutation.mutate(
                                                                    v.id,
                                                                );
                                                            }
                                                        }}
                                                        disabled={
                                                            deleteMutation.isPending
                                                        }
                                                    >
                                                        <Trash2 className="mr-1 h-4 w-4" />
                                                        Slett
                                                    </Button>
                                                </>
                                            )}
                                            {isLocal && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            duplicateVotation(
                                                                index,
                                                            )
                                                        }
                                                    >
                                                        <Copy className="mr-1 h-4 w-4" />
                                                        Dupliser
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() =>
                                                            removeVotation(
                                                                index,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="mr-1 h-4 w-4" />
                                                        Slett
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 border-t p-4 text-sm text-muted-foreground">
                                        {v.description && (
                                            <p>{v.description}</p>
                                        )}
                                        <p>
                                            Type:{' '}
                                            {TYPE_LABELS[v.type] ?? v.type}
                                        </p>
                                        {v.alternatives?.length > 0 && (
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    Alternativer:
                                                </p>
                                                <ul className="list-inside list-disc">
                                                    {v.alternatives.map(
                                                        (a: any) => (
                                                            <li key={a.id}>
                                                                {a.text}
                                                                {a.isWinner
                                                                    ? ' (Vinner)'
                                                                    : ''}
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-xs italic">
                                            Kan ikke redigeres etter at votering
                                            er startet.
                                        </p>
                                    </div>
                                )}
                            </CollapsibleContent>
                        </div>
                    </Collapsible>
                );
            })}

            {newVotation && !isLocal && (
                <div className="rounded-lg border-2 border-primary bg-card">
                    <div className="p-4">
                        <h4 className="mb-4 font-semibold text-foreground">
                            Ny votering
                        </h4>
                        <div className="space-y-4">
                            <VotationFormFields
                                data={newVotation}
                                onChange={(patch) =>
                                    setNewVotation({ ...newVotation, ...patch })
                                }
                            />
                            <div className="flex gap-2 border-t pt-4">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                        createMutation.mutate(newVotation)
                                    }
                                    disabled={
                                        !newVotation.title ||
                                        createMutation.isPending
                                    }
                                >
                                    {createMutation.isPending
                                        ? 'Oppretter...'
                                        : 'Opprett'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setNewVotation(null)}
                                >
                                    Avbryt
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {displayVotations.length === 0 && !newVotation && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    Ingen voteringer ennå. Klikk &quot;Ny votering&quot; for å
                    legge til en.
                </p>
            )}
        </div>
    );
}

function VotationFormFields({
    data,
    onChange,
}: {
    data: VotationFormData;
    onChange: (patch: Partial<VotationFormData>) => void;
}) {
    return (
        <>
            <div className="space-y-2">
                <Label>Tittel</Label>
                <Input
                    value={data.title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    placeholder="Tittel på voteringen"
                    maxLength={255}
                />
            </div>

            <div className="space-y-2">
                <Label>Beskrivelse (valgfritt)</Label>
                <Textarea
                    value={data.description ?? ''}
                    onChange={(e) => onChange({ description: e.target.value })}
                    rows={2}
                />
            </div>

            <div className="space-y-2">
                <Label>Type</Label>
                <Select
                    value={data.type}
                    onValueChange={(type) =>
                        onChange({
                            type: type as 'SIMPLE' | 'QUALIFIED' | 'STV',
                            majorityThreshold:
                                type === 'QUALIFIED'
                                    ? 50
                                    : data.majorityThreshold,
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue>{TYPE_LABELS[data.type]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="SIMPLE">Simpelt flertall</SelectItem>
                        <SelectItem value="QUALIFIED">
                            Kvalifisert flertall
                        </SelectItem>
                        <SelectItem value="STV">
                            Preferansevalg (STV)
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {data.type === 'QUALIFIED' && (
                <div className="space-y-2">
                    <Label>Terskel (%)</Label>
                    <Select
                        value={String(data.majorityThreshold)}
                        onValueChange={(v) =>
                            onChange({ majorityThreshold: Number(v) })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue>{data.majorityThreshold}%</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="67">67%</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {data.type === 'STV' && (
                <div className="space-y-2">
                    <Label>Antall vinnere</Label>
                    <Input
                        type="number"
                        min={1}
                        value={data.numberOfWinners}
                        onChange={(e) =>
                            onChange({
                                numberOfWinners: Number(e.target.value),
                            })
                        }
                    />
                </div>
            )}

            {data.type !== 'STV' && (
                <div className="flex items-center gap-3">
                    <Switch
                        checked={data.blankVotes}
                        onCheckedChange={(checked) =>
                            onChange({ blankVotes: checked })
                        }
                    />
                    <Label>Tillat blanke stemmer</Label>
                </div>
            )}

            <div className="flex items-center gap-3">
                <Switch
                    checked={data.hiddenVotes}
                    onCheckedChange={(checked) =>
                        onChange({ hiddenVotes: checked })
                    }
                />
                <Label>Skjul resultater for deltakere</Label>
            </div>

            <AlternativesEditor
                alternatives={data.alternatives}
                onChange={(alternatives) => onChange({ alternatives })}
            />
        </>
    );
}

function AlternativesEditor({
    alternatives,
    onChange,
}: {
    alternatives: { text: string; index: number }[];
    onChange: (alternatives: { text: string; index: number }[]) => void;
}) {
    function addAlternative() {
        onChange([...alternatives, { text: '', index: alternatives.length }]);
    }

    function updateAlternative(index: number, text: string) {
        const updated = [...alternatives];
        updated[index] = { ...updated[index], text };
        onChange(updated);
    }

    function removeAlternative(index: number) {
        onChange(
            alternatives
                .filter((_, i) => i !== index)
                .map((a, i) => ({ ...a, index: i })),
        );
    }

    return (
        <div className="space-y-2">
            <Label>Alternativer</Label>
            {alternatives.map((alt, index) => (
                <div key={index} className="flex gap-2">
                    <Input
                        value={alt.text}
                        onChange={(e) =>
                            updateAlternative(index, e.target.value)
                        }
                        placeholder={`Alternativ ${index + 1}`}
                        maxLength={120}
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAlternative(index)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAlternative}
            >
                <Plus className="mr-1 h-4 w-4" />
                Legg til alternativ
            </Button>
        </div>
    );
}
