import { useState } from 'react';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Textarea } from '#/components/ui/textarea';
import { Switch } from '#/components/ui/switch';

export interface MeetingFormData {
    title: string;
    organization: string;
    description: string;
    startTime: string;
    allowSelfRegistration: boolean;
}

interface MeetingFormProps {
    initialData?: MeetingFormData;
    onSubmit: (data: MeetingFormData) => void | Promise<void>;
    submitLabel: string;
    loading?: boolean;
}

const defaultData: MeetingFormData = {
    title: '',
    organization: '',
    description: '',
    startTime: '',
    allowSelfRegistration: false,
};

export default function MeetingForm({
    initialData,
    onSubmit,
    submitLabel,
    loading,
}: MeetingFormProps) {
    const [form, setForm] = useState<MeetingFormData>(
        initialData ?? defaultData,
    );

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        void onSubmit(form);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="title">Tittel</Label>
                <Input
                    id="title"
                    value={form.title}
                    onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Møtetittel"
                    required
                    maxLength={255}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="organization">Organisasjon</Label>
                <Input
                    id="organization"
                    value={form.organization}
                    onChange={(e) =>
                        setForm({ ...form, organization: e.target.value })
                    }
                    placeholder="Navn på organisasjonen"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Beskrivelse (valgfritt)</Label>
                <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Kort beskrivelse av møtet"
                    rows={3}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="startTime">Starttid</Label>
                <Input
                    id="startTime"
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) =>
                        setForm({ ...form, startTime: e.target.value })
                    }
                    required
                />
            </div>

            <div className="flex items-center gap-3">
                <Switch
                    id="allowSelfRegistration"
                    checked={form.allowSelfRegistration}
                    onCheckedChange={(checked) =>
                        setForm({ ...form, allowSelfRegistration: checked })
                    }
                />
                <Label htmlFor="allowSelfRegistration">
                    Tillat selvregistrering
                </Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Lagrer...' : submitLabel}
            </Button>
        </form>
    );
}
