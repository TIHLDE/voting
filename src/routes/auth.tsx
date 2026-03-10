import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { authClient } from '#/lib/auth-client';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email,
          password,
          name,
        });
        if (result.error) {
          setError(result.error.message ?? 'Noe gikk galt ved registrering');
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        if (result.error) {
          setError(result.error.message ?? 'Feil e-post eller passord');
          return;
        }
      }
      void navigate({ to: redirectTo || '/meetings' });
    } catch {
      setError('Noe gikk galt. Vennligst prov igjen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">
          {isSignUp ? 'Opprett konto' : 'Logg inn'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Vennligst vent...' : isSignUp ? 'Opprett konto' : 'Logg inn'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? (
            <p>
              Har du allerede en konto?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                }}
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
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                }}
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
