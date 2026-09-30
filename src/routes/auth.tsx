import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { authClient } from '#/lib/auth-client';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Separator } from '#/components/ui/separator';

const searchSchema = z.object({
    redirect: z.string().optional(),
});

export const Route = createFileRoute('/auth')({
    validateSearch: searchSchema,
    component: AuthPage,
});

function AuthPage() {
    const { redirect: redirectTo } = Route.useSearch();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // better-auth returns { data, error } instead of throwing, so surface
    // errors by throwing inside mutationFn to feed mutation.error
    const oauthMutation = useMutation({
        mutationFn: async () => {
            const result = await authClient.signIn.social({
                provider: 'photon',
                callbackURL: redirectTo || '/meetings',
            });
            if (result.error) {
                throw new Error(
                    result.error.message ?? 'Inlogging med TIHLDE feilet',
                );
            }
        },
    });

    const authMutation = useMutation({
        mutationFn: async () => {
            const result = isSignUp
                ? await authClient.signUp.email({ email, password, name })
                : await authClient.signIn.email({ email, password });
            if (result.error) {
                throw new Error(
                    result.error.message ??
                        (isSignUp
                            ? 'Noe gikk galt ved registrering'
                            : 'Feil e-post eller passord'),
                );
            }
        },
        onSuccess: () => {
            void queryClient.invalidateQueries();
            void navigate({ to: redirectTo || '/meetings' });
        },
    });

    function switchMode() {
        setIsSignUp((s) => !s);
        authMutation.reset();
    }

    return (
        <main className="mx-auto max-w-md px-4 py-12">
            <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
                <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
                    {isSignUp ? 'Opprett konto' : 'Logg inn'}
                </h1>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                    TIHLDE-medlemmer logger inn med TIHLDE-kontoen sin.
                </p>

                <Button
                    type="button"
                    className="w-full"
                    disabled={oauthMutation.isPending || authMutation.isPending}
                    onClick={() => oauthMutation.mutate()}
                >
                    {oauthMutation.isPending
                        ? 'Sender deg til tihlde.org...'
                        : 'Logg inn med TIHLDE'}
                </Button>

                <div className="relative my-6">
                    <Separator />
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-card px-2 text-xs text-muted-foreground">
                            ELLER
                        </span>
                    </span>
                </div>

                <p className="mb-4 text-center text-sm text-muted-foreground">
                    Eksterne administratorer kan logge inn eller opprette konto
                    med e-post.
                </p>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        authMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    {isSignUp && (
                        <div className="space-y-2">
                            <Label htmlFor="name">Navn</Label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ditt navn"
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email">E-post</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="din@epost.no"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Passord</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Passord"
                            required
                            minLength={8}
                        />
                    </div>

                    {oauthMutation.error && (
                        <p className="text-sm text-destructive">
                            {oauthMutation.error.message}
                        </p>
                    )}
                    {authMutation.error && (
                        <p className="text-sm text-destructive">
                            {authMutation.error.message}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={authMutation.isPending}
                    >
                        {authMutation.isPending
                            ? 'Vennligst vent...'
                            : isSignUp
                              ? 'Opprett konto'
                              : 'Logg inn'}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    {isSignUp ? (
                        <p>
                            Har du allerede en konto?{' '}
                            <button
                                type="button"
                                onClick={switchMode}
                                className="font-semibold text-foreground hover:underline"
                            >
                                Logg inn
                            </button>
                        </p>
                    ) : (
                        <p>
                            Har du ikke en konto?{' '}
                            <button
                                type="button"
                                onClick={switchMode}
                                className="font-semibold text-foreground hover:underline"
                            >
                                Opprett konto
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </main>
    );
}
