import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getServerSession } from '#/server/auth-session.server.ts';

const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getServerSession();
  return session;
});

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const session = await getSessionFn();
    if (!session) {
      throw redirect({ to: '/auth', search: { redirect: location.href } });
    }
    return { session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Outlet />;
}
