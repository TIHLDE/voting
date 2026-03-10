import { authClient } from '#/lib/auth-client';
import { Link } from '@tanstack/react-router';
import { Button, buttonVariants } from '#/components/ui/button';

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession();

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
          Mine moter
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <span className="text-xs font-medium text-muted-foreground">
            {session.user.name?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void authClient.signOut();
          }}
        >
          Logg ut
        </Button>
      </div>
    );
  }

  return (
    <Link to="/auth" className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' no-underline'}>
      Logg inn
    </Link>
  );
}
