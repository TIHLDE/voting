import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { registerAsParticipant } from '#/server/participants.ts';
import { Button } from '#/components/ui/button';

export const Route = createFileRoute('/_authenticated/meetings/$meetingId_/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const { meetingId } = Route.useParams();
  const navigate = useNavigate();

  const registerMutation = useMutation({
    mutationFn: () => registerAsParticipant({ data: { meetingId } }),
    onSuccess: () => {
      void navigate({
        to: '/meetings/$meetingId',
        params: { meetingId },
      });
    },
  });

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <section className="rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <h1 className="mb-4 text-2xl font-bold text-foreground">Bli med i motet</h1>
        <p className="mb-6 text-muted-foreground">
          Klikk knappen under for a registrere deg som deltaker i dette motet.
        </p>
        <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending} className="w-full">
          {registerMutation.isPending ? 'Registrerer...' : 'Registrer meg'}
        </Button>
        {registerMutation.error && <p className="mt-4 text-sm text-destructive">{registerMutation.error.message}</p>}
      </section>
    </main>
  );
}
