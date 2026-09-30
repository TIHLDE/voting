import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { MenuIcon } from 'lucide-react';
import BetterAuthHeader from '../integrations/better-auth/header-user';
import ThemeToggle from './ThemeToggle';
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
                    <Link
                        to="/"
                        onClick={close}
                        className={mobileLinkClassName}
                        activeProps={mobileLinkActiveProps}
                        activeOptions={{ exact: true }}
                    >
                        Hjem
                    </Link>
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
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {user.name
                                                ?.charAt(0)
                                                .toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                    <span className="truncate text-sm font-medium">
                                        {user.name}
                                    </span>
                                </div>
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
        <header className="sticky top-0 z-50 border-b bg-background/95 px-4 backdrop-blur-lg">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 py-3">
                <Link
                    to="/"
                    className="text-base font-bold tracking-tight text-foreground no-underline"
                >
                    {APP_NAME}
                </Link>

                <div className="hidden items-center gap-4 text-sm font-medium sm:flex">
                    <Link
                        to="/"
                        className="text-muted-foreground no-underline transition hover:text-foreground"
                        activeProps={{
                            className: 'text-foreground no-underline',
                        }}
                        activeOptions={{ exact: true }}
                    >
                        Hjem
                    </Link>
                </div>

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
