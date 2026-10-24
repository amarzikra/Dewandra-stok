import { createFileRoute } from "@tanstack/react-router";
import { withApiSession } from "@/lib/api.server";
import { getReport, reportCsv } from "@/services/reports.service.server";
import { reportSchema } from "@/validators/inventory";

export const Route = createFileRoute("/api/reports/export")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          const query = reportSchema.parse(
            Object.fromEntries(new URL(request.url).searchParams),
          );
          const report = await getReport(session.user.id, query);
          const { filename, csv } = reportCsv(report);
          return new Response(`\uFEFF${csv}`, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }),
    },
  },
});
