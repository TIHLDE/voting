import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/meetings')({
  component: MeetingsLayout,
});

function MeetingsLayout() {
  return <Outlet />;
}
