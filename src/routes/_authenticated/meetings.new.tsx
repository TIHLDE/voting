import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMeeting } from '#/server/meetings.ts';
import { createVotations } from '#/server/votations.ts';
import { addParticipants } from '#/server/participants.ts';
import WizardShell from '#/components/WizardShell';
import MeetingForm from '#/components/MeetingForm';
import type { MeetingFormData } from '#/components/MeetingForm';
import VotationEditor from '#/components/VotationEditor';
import type { VotationFormData } from '#/components/VotationEditor';
import ManageParticipants from '#/components/ManageParticipants';
import type { ParticipantInput } from '#/components/ManageParticipants';
import { Button } from '#/components/ui/button';

export const Route = createFileRoute('/_authenticated/meetings/new')({
    component: NewMeetingWizard,
});

const STEPS = ['Møtedetaljer', 'Voteringer', 'Deltakere'];

function NewMeetingWizard() {
    const [step, setStep] = useState(0);
    const [meetingData, setMeetingData] = useState<MeetingFormData | null>(
        null,
    );
    const [votations, setVotations] = useState<VotationFormData[]>([]);
    const [participants, setParticipants] = useState<ParticipantInput[]>([]);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!meetingData) throw new Error('Mangler møtedetaljer');

            const newMeeting = await createMeeting({ data: meetingData });

            if (votations.length > 0) {
                await createVotations({
                    data: {
                        meetingId: newMeeting.id,
                        votations: votations.map((v, i) => ({
                            ...v,
                            index: i,
                        })),
                    },
                });
            }

            if (participants.length > 0) {
                await addParticipants({
                    data: {
                        meetingId: newMeeting.id,
                        participants,
                    },
                });
            }

            return newMeeting;
        },
        onSuccess: async (newMeeting) => {
            await queryClient.invalidateQueries({ queryKey: ['meetings'] });
            void navigate({
                to: '/meetings/$meetingId',
                params: { meetingId: newMeeting.id },
            });
        },
    });

    function handleMeetingSubmit(data: MeetingFormData) {
        setMeetingData(data);
        setStep(1);
    }

    return (
        <main className="mx-auto max-w-5xl px-4 py-12">
            <h1 className="mb-8 text-center text-3xl font-bold text-foreground">
                Opprett nytt møte
            </h1>

            <WizardShell
                currentStep={step}
                steps={STEPS}
                onStepChange={setStep}
            >
                <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm sm:p-8">
                    {step === 0 && (
                        <MeetingForm
                            initialData={meetingData ?? undefined}
                            onSubmit={handleMeetingSubmit}
                            submitLabel="Neste: Voteringer"
                        />
                    )}

                    {step === 1 && (
                        <div className="space-y-6">
                            <VotationEditor
                                votations={votations}
                                onChange={setVotations}
                            />
                            <div className="flex justify-between">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep(0)}
                                >
                                    Tilbake
                                </Button>
                                <Button onClick={() => setStep(2)}>
                                    Neste: Deltakere
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <ManageParticipants
                                participants={participants}
                                onChange={setParticipants}
                            />
                            <div className="flex justify-between">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep(1)}
                                >
                                    Tilbake
                                </Button>
                                <Button
                                    onClick={() => createMutation.mutate()}
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending
                                        ? 'Oppretter...'
                                        : 'Opprett møte'}
                                </Button>
                            </div>
                            {createMutation.error && (
                                <p className="text-sm text-destructive">
                                    {createMutation.error.message}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </WizardShell>
        </main>
    );
}
