import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMeetingById,
  updateMeeting,
  deleteMeeting,
} from '#/server/meetings.ts'
import WizardShell from '#/components/WizardShell'
import MeetingForm from '#/components/MeetingForm'
import type { MeetingFormData } from '#/components/MeetingForm'
import VotationEditor from '#/components/VotationEditor'
import ManageParticipants from '#/components/ManageParticipants'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute(
  '/_authenticated/meetings/$meetingId/edit'
)({
  component: EditMeeting,
})

const STEPS = ['Motedetaljer', 'Voteringer', 'Deltakere']

function EditMeeting() {
  const { meetingId } = Route.useParams()
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)

  const { data: meeting } = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: () => getMeetingById({ data: { meetingId } }),
  })

  const updateMutation = useMutation({
    mutationFn: (data: MeetingFormData) =>
      updateMeeting({
        data: { meetingId, ...data },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteMeeting({ data: { meetingId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meetings'] })
      void navigate({ to: '/meetings' })
    },
  })

  if (!meeting) return null

  const isOwner = meeting.ownerId === session.user.id

  const initialData: MeetingFormData = {
    title: meeting.title,
    organization: meeting.organization,
    description: meeting.description ?? '',
    startTime: new Date(meeting.startTime).toISOString().slice(0, 16),
    allowSelfRegistration: meeting.allowSelfRegistration,
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold text-foreground">
        Rediger mote
      </h1>

      <WizardShell currentStep={step} steps={STEPS} onStepChange={setStep}>
        <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          {step === 0 && (
            <div className="space-y-6">
              <MeetingForm
                initialData={initialData}
                onSubmit={(data) => {
                  updateMutation.mutate(data)
                  setStep(1)
                }}
                submitLabel="Lagre og neste"
                loading={updateMutation.isPending}
              />
              {isOwner && (
                <div className="border-t pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Er du sikker pa at du vil slette dette motet?'
                        )
                      ) {
                        deleteMutation.mutate()
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Slett mote
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <VotationEditor
                meetingId={meetingId}
                onChange={() => {}}
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(0)}>
                  Tilbake
                </Button>
                <Button onClick={() => setStep(2)}>Neste</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <ManageParticipants meetingId={meetingId} />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Tilbake
                </Button>
                <Button
                  onClick={() =>
                    void navigate({
                      to: '/meetings/$meetingId',
                      params: { meetingId },
                    })
                  }
                >
                  Ferdig
                </Button>
              </div>
            </div>
          )}
        </div>
      </WizardShell>
    </main>
  )
}
