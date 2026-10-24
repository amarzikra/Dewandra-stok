import { createFileRoute } from "@tanstack/react-router";
import { withApiSession } from "@/lib/api.server";
import { getReport } from "@/services/reports.service.server";
import { reportSchema } from "@/validators/inventory";

export const Route = createFileRoute("/api/reports/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          const query = reportSchema.parse(
            Object.fromEntries(new URL(request.url).searchParams),
          );
          return Response.json({
            data: await getReport(session.user.id, query),
          });
        }),
    },
  },
});
