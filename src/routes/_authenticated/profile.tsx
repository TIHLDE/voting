import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '#/lib/auth-client';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Separator } from '#/components/ui/separator';

export const Route = createFileRoute('/_authenticated/profile')({
    component: ProfilePage,
});

function ProfilePage() {
    const { data: session } = authClient.useSession();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(false);
        setChangingPassword(true);

        try {
            const result = await authClient.changePassword({
                currentPassword,
                newPassword,
            });
            if (result.error) {
                setPasswordError(
                    result.error.message ?? 'Kunne ikke endre passord',
                );
                return;
            }
            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
        } catch {
            setPasswordError('Noe gikk galt. Vennligst prov igjen.');
        } finally {
            setChangingPassword(false);
        }
    }

    async function handleDeleteAccount() {
        setDeleting(true);
        try {
            await authClient.deleteUser();
            void navigate({ to: '/' });
        } catch {
            setDeleting(false);
        }
    }

    return (
        <main className="mx-auto max-w-lg px-4 py-12">
            <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
                <h1 className="mb-6 text-3xl font-bold text-foreground">
                    Min profil
                </h1>

                <div className="mb-6 space-y-2">
                    <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Navn:</span>{' '}
                        {session?.user.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">E-post:</span>{' '}
                        {session?.user.email}
                    </p>
                </div>

                <Separator className="my-6" />

                <h2 className="mb-4 text-lg font-semibold text-foreground">
                    Endre passord
                </h2>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">
                            Navarende passord
                        </Label>
                        <Input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">Nytt passord</Label>
                        <Input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                    </div>

                    {passwordError && (
                        <p className="text-sm text-destructive">
                            {passwordError}
                        </p>
                    )}
                    {passwordSuccess && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                            Passordet ble endret.
                        </p>
                    )}

                    <Button type="submit" disabled={changingPassword}>
                        {changingPassword ? 'Endrer...' : 'Endre passord'}
                    </Button>
                </form>

                <Separator className="my-6" />

                <h2 className="mb-4 text-lg font-semibold text-destructive">
                    Slett konto
                </h2>
                <p className="mb-4 text-sm text-muted-foreground">
                    Denne handlingen kan ikke angres. Alle dine data vil bli
                    slettet, og eventuelle apne voteringer du deltar i vil bli
                    ugyldiggjort.
                </p>

                {!showDeleteConfirm ? (
                    <Button
                        variant="destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        Slett min konto
                    </Button>
                ) : (
                    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                        <p className="text-sm font-semibold text-destructive">
                            Er du sikker pa at du vil slette kontoen din?
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="destructive"
                                onClick={() => void handleDeleteAccount()}
                                disabled={deleting}
                            >
                                {deleting ? 'Sletter...' : 'Ja, slett kontoen'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Avbryt
                            </Button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
