import {
    createFileRoute,
    stripSearchParams,
    useNavigate,
} from '@tanstack/react-router';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { authClient } from '#/lib/auth-client';
import { Button } from '#/components/ui/button';
import { Separator } from '#/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs';
import { assertNever } from '#/lib/utils';
import { APP_NAME } from '#/env';
import { formHandlers, useAppForm } from '#/hooks/form';

const searchDefaults = {
    redirect: '/meetings',
};

const searchSchema = z.object({
    redirect: z.string().default(searchDefaults.redirect),
});

export const Route = createFileRoute('/auth')({
    validateSearch: searchSchema,
    search: {
        middlewares: [stripSearchParams(searchDefaults)],
    },
    component: AuthPage,
});

type AuthMutationData = {
    redirectTo?: string;
} & (
    | {
          type: 'register';
          name: string;
          email: string;
          password: string;
      }
    | {
          type: 'login';
          email: string;
          password: string;
      }
    | {
          type: 'oauth';
      }
);

const authMutationOptions = mutationOptions({
    mutationKey: ['auth', 'login-register-mutation'],
    async mutationFn(data: AuthMutationData) {
        let result;

        const authType = data.type;

        switch (authType) {
            case 'oauth':
                result = await authClient.signIn.social({
                    provider: 'photon',
                    callbackURL: data.redirectTo,
                });
                break;

            case 'login':
                result = await authClient.signIn.email({
                    email: data.email,
                    password: data.password,
                });
                break;

            case 'register':
                result = await authClient.signUp.email({
                    name: data.name,
                    email: data.email,
                    password: data.password,
                });
                break;

            default:
                assertNever(authType);
                throw new Error('Unsupported auth path: ' + authType);
                break;
        }

        if (result.error) {
            throw new Error(
                result.error.message ??
                    (authType == 'login'
                        ? 'E-post eller passord er feil'
                        : 'Noe gikk galt'),
            );
        }
    },
    async onSuccess(_, __, ___, context) {
        await context.client.invalidateQueries();
    },
});

function AuthPage() {
    const { redirect } = Route.useSearch();
    const authMutation = useMutation(authMutationOptions);

    return (
        <main className="mx-auto max-w-md px-4 py-12">
            <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
                <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
                    Autentiser med {APP_NAME}
                </h1>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                    TIHLDE-medlemmer logger inn med TIHLDE-kontoen sin.
                </p>

                <Button
                    type="button"
                    className="w-full"
                    disabled={authMutation.isPending}
                    onClick={() =>
                        authMutation.mutate({
                            type: 'oauth',
                            redirectTo: redirect,
                        })
                    }
                >
                    Logg inn med TIHLDE
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

                <Tabs defaultValue="login">
                    <TabsList className="w-full p-2 h-fit!">
                        <TabsTrigger
                            value="login"
                            className="p-1 data-active:bg-primary! data-active:text-accent!"
                        >
                            Logg Inn
                        </TabsTrigger>
                        <TabsTrigger
                            value="signup"
                            className="p-1 data-active:bg-primary! data-active:text-accent!"
                        >
                            Opprett Konto
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="login">
                        <LoginForm />
                    </TabsContent>
                    <TabsContent value="signup">
                        <SignupForm />
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}

const loginSchema = z.object({
    email: z.email(),
    password: z.string(),
});
const signupSchema = loginSchema
    .extend({
        name: z.string().min(4),
        password: z.string().min(8),
        confirmPassword: z.string(),
    })
    .superRefine((v, ctx) => {
        if (v.confirmPassword != v.password) {
            ctx.addIssue({
                code: 'custom',
                message: 'Passwords must match',
                path: ['confirmPassword'],
            });
            return z.NEVER;
        }
    });

function LoginForm() {
    const { redirect } = Route.useSearch();
    const navigate = useNavigate();
    const authMutation = useMutation(authMutationOptions);

    const form = useAppForm({
        defaultValues: {
            email: '',
            password: '',
        },
        validators: {
            onBlur: loginSchema,
            onSubmit: loginSchema,
            onChange: loginSchema,
        },

        async onSubmit({ value: { email, password }, formApi }) {
            try {
                await authMutation.mutateAsync({
                    type: 'login',
                    email,
                    password,
                });
                await navigate({ href: redirect });
            } catch (e) {
                formApi.setErrorMap({
                    onSubmit: {
                        form: e instanceof Error ? e.message : 'Noe gikk galt',
                        fields: {},
                    },
                });
            }
        },
    });
    return (
        <form.AppForm>
            <form {...formHandlers(form)} className="space-y-4">
                <form.AppField
                    name="email"
                    children={(field) => (
                        <field.InputField
                            label="E-post"
                            type="email"
                            autoComplete="email"
                        />
                    )}
                />

                <form.AppField
                    name="password"
                    children={(field) => (
                        <field.PasswordField label="Passord" />
                    )}
                />
                <form.SubmitButton className="w-full" loading="Logger inn...">
                    Logg inn
                </form.SubmitButton>

                <form.FormErrors />
            </form>
        </form.AppForm>
    );
}

function SignupForm() {
    const { redirect } = Route.useSearch();
    const navigate = useNavigate();
    const authMutation = useMutation(authMutationOptions);

    const form = useAppForm({
        defaultValues: {
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
        },
        validators: {
            onBlur: signupSchema,
            onSubmit: signupSchema,
            onChange: signupSchema,
        },

        async onSubmit({ value: { name, email, password }, formApi }) {
            try {
                await authMutation.mutateAsync({
                    type: 'register',
                    name,
                    email,
                    password,
                });
                await navigate({ href: redirect });
            } catch (e) {
                formApi.setErrorMap({
                    onSubmit: {
                        form: e instanceof Error ? e.message : 'Noe gikk galt',
                        fields: {},
                    },
                });
            }
        },
    });
    return (
        <form.AppForm>
            <form {...formHandlers(form)} className="space-y-4">
                <form.AppField
                    name="name"
                    children={(field) => (
                        <field.InputField label="Navn" autoComplete="name" />
                    )}
                />

                <form.AppField
                    name="email"
                    children={(field) => (
                        <field.InputField
                            label="E-post"
                            type="email"
                            autoComplete="email"
                        />
                    )}
                />

                <form.AppField
                    name="password"
                    children={(field) => (
                        <field.PasswordField
                            label="Passord"
                            autoComplete="new-password"
                        />
                    )}
                />

                <form.AppField
                    name="confirmPassword"
                    children={(field) => (
                        <field.PasswordField
                            label="Bekreft passord"
                            autoComplete="new-password"
                        />
                    )}
                />
                <form.SubmitButton
                    className="w-full"
                    loading="Oppretter konto..."
                >
                    Opprett konto
                </form.SubmitButton>

                <form.FormErrors />
            </form>
        </form.AppForm>
    );
}
