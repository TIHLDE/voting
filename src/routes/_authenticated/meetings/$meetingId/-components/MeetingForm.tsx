import { useState } from 'react';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Switch } from '#/components/ui/switch';

export interface MeetingFormData {
    title: string;
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
