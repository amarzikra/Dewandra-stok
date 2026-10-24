import { createFileRoute } from "@tanstack/react-router";
import { ApiError, withApiSession } from "@/lib/api.server";
import { ForbiddenError, listUsers } from "@/services/users.service.server";

export const Route = createFileRoute("/api/users/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          try {
            return Response.json({
              data: await listUsers(session.user.id),
            });
          } catch (error) {
            if (error instanceof ForbiddenError)
              throw new ApiError(403, "FORBIDDEN", error.message);
            throw error;
          }
        }),
    },
  },
});
