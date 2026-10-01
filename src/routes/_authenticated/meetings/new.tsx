import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createMeeting } from '#/server/meetings';
import { formHandlers, useAppForm } from '#/hooks/form';

export const Route = createFileRoute('/_authenticated/meetings/new')({
    component: NewMeetingPage,
});

const meetingSchema = z.object({
    title: z.string().nonempty().max(255),
    description: z.string(),
    allowSelfRegistration: z.boolean(),
});

function NewMeetingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const form = useAppForm({
        defaultValues: {
            title: '',
            description: '',
            allowSelfRegistration: true,
        },
        validators: {
            onBlur: meetingSchema,
            onSubmit: meetingSchema,
            onChange: meetingSchema,
        },
        async onSubmit({ value, formApi }) {
            try {
                const newMeeting = await createMeeting({ data: value });
                await queryClient.invalidateQueries({ queryKey: ['meetings'] });
                await navigate({
                    to: '/meetings/$meetingId',
                    params: { meetingId: newMeeting.id },
                });
            } catch (e) {
                formApi.setErrorMap({
                    onSubmit: {
                        form: e instanceof Error ? e.message : 'Noe gikk galt',
                        fields: {},
                    },
                });
            }
        },
    });

    return (
        <main className="mx-auto max-w-2xl px-4 py-12">
            <h1 className="mb-8 text-center text-3xl font-bold text-foreground">
                Opprett nytt møte
            </h1>

            <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
                <form.AppForm>
                    <form {...formHandlers(form)} className="space-y-4">
                        <form.AppField
                            name="title"
                            children={(field) => (
                                <field.InputField
                                    label="Tittel"
                                    required
                                    placeholder="Møtetittel"
                                    maxLength={255}
                                />
                            )}
                        />

                        <form.AppField
                            name="description"
                            children={(field) => (
                                <field.Field>
                                    <field.Label>
                                        Beskrivelse (valgfritt)
                                    </field.Label>
                                    <field.Textarea
                                        placeholder="Kort beskrivelse av møtet"
                                        rows={3}
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        />

                        <form.AppField
                            name="allowSelfRegistration"
                            children={(field) => (
                                <field.Field orientation="horizontal">
                                    <field.Switch />
                                    <field.Label>
                                        Tillat selvregistrering
                                    </field.Label>
                                </field.Field>
                            )}
                        />

                        <form.SubmitButton
                            className="w-full"
                            loading="Oppretter..."
                        >
                            Opprett møte
                        </form.SubmitButton>

                        <form.FormErrors />
                    </form>
                </form.AppForm>
            </div>
        </main>
    );
}
