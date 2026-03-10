import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVotationsForMeeting } from '#/server/votations.ts';
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
import { ChevronDown, GripVertical, Plus, Trash2, Copy } from 'lucide-react';

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

export default function VotationEditor({
    meetingId,
    votations: localVotations,
    onChange,
}: VotationEditorProps) {
    const isLocal = !meetingId;

    const { data: serverVotations } = useQuery({
        queryKey: ['votations', meetingId],
        queryFn: () =>
            getVotationsForMeeting({ data: { meetingId: meetingId! } }),
        enabled: !!meetingId,
    });

    const votations = isLocal ? (localVotations ?? []) : [];
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    function updateLocal(index: number, data: Partial<VotationFormData>) {
        if (!isLocal) return;
        const updated = [...votations];
        updated[index] = { ...updated[index], ...data };
        onChange?.(updated);
    }

    function addVotation() {
        if (isLocal) {
            onChange?.([...votations, { ...defaultVotation }]);
            setOpenIndex(votations.length);
        }
    }

    function removeVotation(index: number) {
        if (isLocal) {
            const updated = votations.filter((_, i) => i !== index);
            onChange?.(updated);
            setOpenIndex(null);
        }
    }

    function duplicateVotation(index: number) {
        if (isLocal) {
            const dup = {
                ...votations[index],
                alternatives: [...votations[index].alternatives],
            };
            onChange?.([...votations, dup]);
        }
    }

    // For server mode, show saved votations
    const displayVotations = isLocal ? votations : (serverVotations ?? []);

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

            {displayVotations.map((v, index) => {
                const isOpen = openIndex === index;
                const votationData = isLocal ? (v as VotationFormData) : null;

                return (
                    <Collapsible
                        key={index}
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
                                <span className="text-xs text-muted-foreground">
                                    {v.type === 'STV'
                                        ? 'STV'
                                        : v.type === 'QUALIFIED'
                                          ? `Kvalifisert ${(v as VotationFormData).majorityThreshold ?? 50}%`
                                          : 'Simpelt flertall'}
                                </span>
                                <ChevronDown
                                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                />
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                {votationData && (
                                    <div className="space-y-4 border-t p-4">
                                        <div className="space-y-2">
                                            <Label>Tittel</Label>
                                            <Input
                                                value={votationData.title}
                                                onChange={(e) =>
                                                    updateLocal(index, {
                                                        title: e.target.value,
                                                    })
                                                }
                                                placeholder="Tittel pa voteringen"
                                                maxLength={255}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>
                                                Beskrivelse (valgfritt)
                                            </Label>
                                            <Textarea
                                                value={
                                                    votationData.description ??
                                                    ''
                                                }
                                                onChange={(e) =>
                                                    updateLocal(index, {
                                                        description:
                                                            e.target.value,
                                                    })
                                                }
                                                rows={2}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Type</Label>
                                            <Select
                                                value={votationData.type}
                                                onValueChange={(type) =>
                                                    updateLocal(index, {
                                                        type: type as
                                                            | 'SIMPLE'
                                                            | 'QUALIFIED'
                                                            | 'STV',
                                                        majorityThreshold:
                                                            type === 'QUALIFIED'
                                                                ? 50
                                                                : votationData.majorityThreshold,
                                                    })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue>
                                                        {
                                                            {
                                                                SIMPLE: 'Simpelt flertall',
                                                                QUALIFIED:
                                                                    'Kvalifisert flertall',
                                                                STV: 'Preferansevalg (STV)',
                                                            }[votationData.type]
                                                        }
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SIMPLE">
                                                        Simpelt flertall
                                                    </SelectItem>
                                                    <SelectItem value="QUALIFIED">
                                                        Kvalifisert flertall
                                                    </SelectItem>
                                                    <SelectItem value="STV">
                                                        Preferansevalg (STV)
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {votationData.type === 'QUALIFIED' && (
                                            <div className="space-y-2">
                                                <Label>Terskel (%)</Label>
                                                <Select
                                                    value={String(
                                                        votationData.majorityThreshold,
                                                    )}
                                                    onValueChange={(v) =>
                                                        updateLocal(index, {
                                                            majorityThreshold:
                                                                Number(v),
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue>
                                                            {
                                                                votationData.majorityThreshold
                                                            }
                                                            %
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="50">
                                                            50%
                                                        </SelectItem>
                                                        <SelectItem value="67">
                                                            67%
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {votationData.type === 'STV' && (
                                            <div className="space-y-2">
                                                <Label>Antall vinnere</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={
                                                        votationData.numberOfWinners
                                                    }
                                                    onChange={(e) =>
                                                        updateLocal(index, {
                                                            numberOfWinners:
                                                                Number(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                        })
                                                    }
                                                />
                                            </div>
                                        )}

                                        {votationData.type !== 'STV' && (
                                            <div className="flex items-center gap-3">
                                                <Switch
                                                    checked={
                                                        votationData.blankVotes
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        updateLocal(index, {
                                                            blankVotes: checked,
                                                        })
                                                    }
                                                />
                                                <Label>
                                                    Tillat blanke stemmer
                                                </Label>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3">
                                            <Switch
                                                checked={
                                                    votationData.hiddenVotes
                                                }
                                                onCheckedChange={(checked) =>
                                                    updateLocal(index, {
                                                        hiddenVotes: checked,
                                                    })
                                                }
                                            />
                                            <Label>
                                                Skjul resultater for deltakere
                                            </Label>
                                        </div>

                                        <AlternativesEditor
                                            alternatives={
                                                votationData.alternatives
                                            }
                                            onChange={(alternatives) =>
                                                updateLocal(index, {
                                                    alternatives,
                                                })
                                            }
                                        />

                                        <div className="flex gap-2 border-t pt-4">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    duplicateVotation(index)
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
                                                    removeVotation(index)
                                                }
                                            >
                                                <Trash2 className="mr-1 h-4 w-4" />
                                                Slett
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CollapsibleContent>
                        </div>
                    </Collapsible>
                );
            })}

            {displayVotations.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    Ingen voteringer enna. Klikk &quot;Ny votering&quot; for a
                    legge til en.
                </p>
            )}
        </div>
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
