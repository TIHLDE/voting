import { authClient } from '#/lib/auth-client';
import { useSignOut } from '#/hooks/useSignOut';
import { Link } from '@tanstack/react-router';
import { Button, buttonVariants } from '#/components/ui/button';
import UserAvatar from '#/components/UserAvatar';

export default function BetterAuthHeader() {
    const { data: session, isPending } = authClient.useSession();
    const signOut = useSignOut();

    if (isPending) {
        return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />;
    }

    if (session?.user) {
        return (
            <div className="flex items-center gap-2">
                <Link
                    to="/meetings"
                    className="text-sm font-medium text-muted-foreground no-underline transition hover:text-foreground"
                >
                    Mine møter
                </Link>
                <Link
                    to="/profile"
                    aria-label="Min profil"
                    className="rounded-full transition hover:opacity-80"
                >
                    <UserAvatar user={session.user} />
                </Link>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        void signOut();
                    }}
                >
                    Logg ut
                </Button>
            </div>
        );
    }

    return (
        <Link
            to="/auth"
            className={
                buttonVariants({ variant: 'outline', size: 'sm' }) +
                ' no-underline'
            }
        >
            Logg inn
        </Link>
    );
}
