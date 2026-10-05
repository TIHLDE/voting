import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { MenuIcon } from 'lucide-react';
import BetterAuthHeader from '../integrations/better-auth/header-user';
import ThemeToggle from './ThemeToggle';
import UserAvatar from './UserAvatar';
import { APP_NAME } from '../env';
import { authClient } from '#/lib/auth-client';
import { useSignOut } from '#/hooks/useSignOut';
import { Button, buttonVariants } from '#/components/ui/button';
import { Separator } from '#/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '#/components/ui/sheet';

const mobileLinkClassName =
    'rounded-md px-3 py-2 text-base font-medium text-muted-foreground no-underline transition hover:bg-accent hover:text-foreground';
const mobileLinkActiveProps = {
    className: 'bg-accent text-foreground no-underline',
};

function MobileMenu() {
    const [open, setOpen] = useState(false);
    const { data: session, isPending } = authClient.useSession();
    const user = session?.user;
    const close = () => setOpen(false);
    const signOut = useSignOut();

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                render={
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="sm:hidden"
                        aria-label="Åpne meny"
                    />
                }
            >
                <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right" className="gap-0">
                <SheetHeader>
                    <SheetTitle>{APP_NAME}</SheetTitle>
                </SheetHeader>
                <Separator />
                <nav className="flex flex-col gap-1 p-2">
                    {user && (
                        <Link
                            to="/meetings"
                            onClick={close}
                            className={mobileLinkClassName}
                            activeProps={mobileLinkActiveProps}
                        >
                            Mine møter
                        </Link>
                    )}
                </nav>
                {!isPending && (
                    <SheetFooter>
                        {user ? (
                            <>
                                <Link
                                    to="/profile"
                                    onClick={close}
                                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-foreground no-underline transition hover:bg-accent"
                                    activeProps={{ className: 'bg-accent' }}
                                >
                                    <UserAvatar user={user} />
                                    <span className="truncate text-sm font-medium">
                                        {user.name}
                                    </span>
                                </Link>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        close();
                                        void signOut();
                                    }}
                                >
                                    Logg ut
                                </Button>
                            </>
                        ) : (
                            <Link
                                to="/auth"
                                onClick={close}
                                className={
                                    buttonVariants({ variant: 'outline' }) +
                                    ' no-underline'
                                }
                            >
                                Logg inn
                            </Link>
                        )}
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}

export default function Header() {
    return (
        <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/95 px-4 backdrop-blur-lg">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 py-3">
                <Link
                    to="/"
                    className="text-base font-bold tracking-tight text-foreground no-underline"
                >
                    {APP_NAME}
                </Link>

                <div className="ml-auto flex items-center gap-2">
                    <div className="hidden sm:block">
                        <BetterAuthHeader />
                    </div>
                    <ThemeToggle />
                    <MobileMenu />
                </div>
            </nav>
        </header>
    );
}
