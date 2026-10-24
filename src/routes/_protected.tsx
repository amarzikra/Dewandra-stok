import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// Pathless layout for signed-in screens. The check runs on the server during
// SSR and again on client navigation. It protects pages only: API routes and
// server functions must verify the session themselves.
export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/sign-in" });
    return { session: context.session };
  },
  component: () => <Outlet />,
});
