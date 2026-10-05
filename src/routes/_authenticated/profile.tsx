import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { authClient } from '#/lib/auth-client';
import { authErrorMessage, NETWORK_ERROR_MESSAGE } from '#/lib/auth-errors';
import { getMyLoginMethods } from '#/server/account';
import { APP_NAME } from '#/env';
import { formHandlers, useAppForm } from '#/hooks/form';
import UserAvatar from '#/components/UserAvatar';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { Separator } from '#/components/ui/separator';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '#/components/ui/alert-dialog';

export const Route = createFileRoute('/_authenticated/profile')({
    loader: ({ context }) =>
        context.queryClient.query({
            queryKey: ['auth', 'login-methods'],
            queryFn: () => getMyLoginMethods(),
        }),
    component: ProfilePage,
});

function ProfilePage() {
    const { session } = Route.useRouteContext();
    const { user } = session;

    const { hasPassword, hasTihlde } = Route.useLoaderData();

    return (
        <main className="mx-auto max-w-3xl px-4 py-12">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                <UserAvatar
                    user={user}
                    className="size-20 [&_[data-slot=avatar-fallback]]:text-2xl"
                />
                <div className="min-w-0 space-y-1">
                    <h1 className="truncate text-3xl font-bold text-foreground">
                        {user.name}
                    </h1>
                    <p className="truncate text-muted-foreground">
                        {user.email}
                    </p>
                    {hasTihlde && (
                        <Badge variant="secondary" className="mt-1">
                            TIHLDE-konto
                        </Badge>
                    )}
                </div>
            </div>

            <Separator className="my-10" />

            <div className="space-y-10">
                <ProfileSection
                    title="Passord"
                    description={
                        hasPassword
                            ? 'Bruk minst 8 tegn. Du forblir innlogget på denne enheten.'
                            : undefined
                    }
                >
                    {hasPassword ? (
                        <ChangePasswordForm />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Du logger inn med TIHLDE-kontoen din, og har derfor
                            ikke et eget passord her. Passordet endrer du på
                            tihlde.org.
                        </p>
                    )}
                </ProfileSection>

                <Separator />

                <ProfileSection
                    title="Slett konto"
                    description={
                        hasTihlde
                            ? `Sletter kun kontoen din på ${APP_NAME} og alle møter du eier. TIHLDE-kontoen din på tihlde.org blir ikke slettet. Dette kan ikke angres.`
                            : `Sletter kontoen din på ${APP_NAME} og alle møter du eier. Dette kan ikke angres.`
                    }
                    destructive
                >
                    <DeleteAccountDialog
                        hasPassword={hasPassword}
                        hasTihlde={hasTihlde}
                    />
                </ProfileSection>
            </div>
        </main>
    );
}

function ProfileSection({
    title,
    description,
    destructive,
    children,
}: {
    title: string;
    description?: string;
    destructive?: boolean;
    children: React.ReactNode;
}) {
    return (
        <section className="grid gap-4 md:grid-cols-[1fr_2fr] md:gap-10">
            <div className="space-y-1">
                <h2
                    className={
                        destructive
                            ? 'font-semibold text-destructive'
                            : 'font-semibold text-foreground'
                    }
                >
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div>{children}</div>
        </section>
    );
}

const changePasswordSchema = z
    .object({
        currentPassword: z.string().nonempty('Skriv inn passordet ditt.'),
        newPassword: z.string().min(8, 'Passordet må ha minst 8 tegn.'),
        confirmPassword: z.string(),
    })
    .superRefine((v, ctx) => {
        if (v.confirmPassword != v.newPassword) {
            ctx.addIssue({
                code: 'custom',
                message: 'Passordene er ikke like.',
                path: ['confirmPassword'],
            });
            return z.NEVER;
        }
    });

function ChangePasswordForm() {
    const form = useAppForm({
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
        validators: {
            onBlur: changePasswordSchema,
            onSubmit: changePasswordSchema,
            onChange: changePasswordSchema,
        },
        async onSubmit({ value: { currentPassword, newPassword }, formApi }) {
            let result;
            try {
                result = await authClient.changePassword({
                    currentPassword,
                    newPassword,
                });
            } catch {
                formApi.setErrorMap({
                    onSubmit: { form: NETWORK_ERROR_MESSAGE, fields: {} },
                });
                return;
            }

            if (result.error) {
                formApi.setErrorMap({
                    onSubmit: {
                        form: authErrorMessage(result.error, {
                            INVALID_PASSWORD:
                                'Det nåværende passordet er feil.',
                        }),
                        fields: {},
                    },
                });
                return;
            }

            formApi.reset();
            toast.success('Passordet ble endret');
        },
    });

    return (
        <form.AppForm>
            <form {...formHandlers(form)} className="space-y-4">
                <form.AppField
                    name="currentPassword"
                    children={(field) => (
                        <field.PasswordField label="Nåværende passord" />
                    )}
                />
                <form.AppField
                    name="newPassword"
                    children={(field) => (
                        <field.PasswordField
                            label="Nytt passord"
                            autoComplete="new-password"
                        />
                    )}
                />
                <form.AppField
                    name="confirmPassword"
                    children={(field) => (
                        <field.PasswordField
                            label="Bekreft nytt passord"
                            autoComplete="new-password"
                        />
                    )}
                />

                <form.SubmitButton loading="Endrer...">
                    Endre passord
                </form.SubmitButton>

                <form.FormErrors />
            </form>
        </form.AppForm>
    );
}

function DeleteAccountDialog({
    hasPassword,
    hasTihlde,
}: {
    hasPassword: boolean;
    hasTihlde: boolean;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const deleteSchema = z.object({
        password: hasPassword
            ? z.string().nonempty('Skriv inn passordet ditt.')
            : z.string(),
    });

    const form = useAppForm({
        defaultValues: {
            password: '',
        },
        validators: {
            onSubmit: deleteSchema,
            onChange: deleteSchema,
        },
        async onSubmit({ value: { password }, formApi }) {
            let result;
            try {
                result = await authClient.deleteUser(
                    hasPassword ? { password } : {},
                );
            } catch {
                formApi.setErrorMap({
                    onSubmit: { form: NETWORK_ERROR_MESSAGE, fields: {} },
                });
                return;
            }

            if (result.error) {
                formApi.setErrorMap({
                    onSubmit: {
                        form: authErrorMessage(result.error, {
                            INVALID_PASSWORD: 'Feil passord.',
                            SESSION_EXPIRED:
                                'Logg ut og inn igjen før du sletter kontoen.',
                        }),
                        fields: {},
                    },
                });
                return;
            }

            await router.navigate({ to: '/' });
            queryClient.clear();
            await router.invalidate();
        },
    });

    return (
        <AlertDialog onOpenChange={(open) => !open && form.reset()}>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
                Slett min konto
            </AlertDialogTrigger>
            <AlertDialogContent>
                <form.AppForm>
                    <form {...formHandlers(form)} className="grid gap-6">
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Slette kontoen din?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Kontoen din på {APP_NAME} og alle møter du eier
                                blir slettet for godt. Pågående voteringer du
                                deltar i kan bli ugyldige.
                            </AlertDialogDescription>
                            {hasTihlde && (
                                <AlertDialogDescription>
                                    TIHLDE-kontoen din på tihlde.org blir{' '}
                                    <strong className="text-foreground">
                                        ikke
                                    </strong>{' '}
                                    slettet. Du kan fortsatt logge inn her med
                                    TIHLDE senere, men får da en ny, tom konto.
                                </AlertDialogDescription>
                            )}
                        </AlertDialogHeader>

                        {hasPassword && (
                            <form.AppField
                                name="password"
                                children={(field) => (
                                    <field.PasswordField label="Bekreft med passordet ditt" />
                                )}
                            />
                        )}

                        <form.FormErrors />

                        <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <form.SubmitButton
                                variant="destructive"
                                loading="Sletter..."
                            >
                                Slett kontoen
                            </form.SubmitButton>
                        </AlertDialogFooter>
                    </form>
                </form.AppForm>
            </AlertDialogContent>
        </AlertDialog>
    );
}
