import { APP_NAME } from '../env';

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="mt-20 border-t px-4 pb-14 pt-10">
            <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
                <p className="m-0">
                    &copy; {year} {APP_NAME}.
                </p>
                <p className="m-0 text-xs font-semibold uppercase tracking-widest">
                    Demokratiske avstemninger, enkelt og trygt
                </p>
            </div>
        </footer>
    );
}
