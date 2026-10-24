import { createFileRoute } from "@tanstack/react-router";
import { withApiSession } from "@/lib/api.server";
import { getDashboard } from "@/services/dashboard.service.server";

export const Route = createFileRoute("/api/dashboard")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) =>
          Response.json({
            data: await getDashboard(session.user.id),
          }),
        ),
    },
  },
});
