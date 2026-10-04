import { Copy, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select';
import { Switch } from '#/components/ui/switch';
import { Textarea } from '#/components/ui/textarea';
import { TYPE_LABELS } from './votation-editor-types';
import type {
    VotationAlternativeFormData,
    VotationFormData,
} from './votation-editor-types';

export function VotationFormFields({
    data,
    onChange,
}: {
    data: VotationFormData;
    onChange: (patch: Partial<VotationFormData>) => void;
}) {
    return (
        <>
            <div className="space-y-2">
                <Label htmlFor={`votation-title-${data.id}`}>Tittel</Label>
                <Input
                    id={`votation-title-${data.id}`}
                    value={data.title}
                    onChange={(event) =>
                        onChange({ title: event.target.value })
                    }
                    placeholder="Tittel på voteringen"
                    maxLength={255}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`votation-description-${data.id}`}>
                    Beskrivelse (valgfritt)
                </Label>
                <Textarea
                    id={`votation-description-${data.id}`}
                    value={data.description ?? ''}
                    onChange={(event) =>
                        onChange({ description: event.target.value })
                    }
                    rows={2}
                />
            </div>
            <VotationSettings data={data} onChange={onChange} />
            <AlternativesEditor
                votationId={data.id}
                alternatives={data.alternatives}
                onChange={(alternatives) => onChange({ alternatives })}
            />
        </>
    );
}

function VotationSettings({
    data,
    onChange,
}: {
    data: VotationFormData;
    onChange: (patch: Partial<VotationFormData>) => void;
}) {
    return (
        <>
            <div className="space-y-2">
                <Label>Type</Label>
                <Select
                    value={data.type}
                    onValueChange={(type) =>
                        onChange({
                            type: type as VotationFormData['type'],
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
                        onValueChange={(value) =>
                            onChange({ majorityThreshold: Number(value) })
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
                    <Label htmlFor={`winner-count-${data.id}`}>
                        Antall vinnere
                    </Label>
                    <Input
                        id={`winner-count-${data.id}`}
                        type="number"
                        min={1}
                        value={data.numberOfWinners}
                        onChange={(event) =>
                            onChange({
                                numberOfWinners: Number(event.target.value),
                            })
                        }
                    />
                </div>
            )}
            <ToggleSetting
                label="Tillat blanke stemmer"
                checked={data.blankVotes}
                onCheckedChange={(blankVotes) => onChange({ blankVotes })}
            />
            <ToggleSetting
                label="Skjul resultater for deltakere"
                checked={data.hiddenVotes}
                onCheckedChange={(hiddenVotes) => onChange({ hiddenVotes })}
            />
        </>
    );
}

function ToggleSetting({
    label,
    checked,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
            <Label>{label}</Label>
        </div>
    );
}

function AlternativesEditor({
    votationId,
    alternatives,
    onChange,
}: {
    votationId: string;
    alternatives: VotationAlternativeFormData[];
    onChange: (alternatives: VotationAlternativeFormData[]) => void;
}) {
    function updateAlternative(id: string, text: string) {
        onChange(
            alternatives.map((alternative) =>
                alternative.id === id ? { ...alternative, text } : alternative,
            ),
        );
    }

    function removeAlternative(id: string) {
        onChange(
            alternatives
                .filter((alternative) => alternative.id !== id)
                .map((alternative, index) => ({ ...alternative, index })),
        );
    }

    return (
        <div className="space-y-2">
            <Label>Alternativer</Label>
            {alternatives.map((alternative, index) => (
                <div key={alternative.id} className="flex gap-2">
                    <Input
                        aria-label={`Alternativ ${index + 1}`}
                        value={alternative.text}
                        onChange={(event) =>
                            updateAlternative(
                                alternative.id,
                                event.target.value,
                            )
                        }
                        placeholder={`Alternativ ${index + 1}`}
                        maxLength={120}
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        aria-label={`Fjern alternativ ${index + 1}`}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeAlternative(alternative.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                    onChange([
                        ...alternatives,
                        {
                            id: `${votationId}-${crypto.randomUUID()}`,
                            text: '',
                            index: alternatives.length,
                        },
                    ])
                }
            >
                <Plus className="mr-1 h-4 w-4" />
                Legg til alternativ
            </Button>
        </div>
    );
}

export function VotationActions({
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
