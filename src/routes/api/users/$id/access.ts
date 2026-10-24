import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import { ForbiddenError, setUserAccess } from "@/services/users.service.server";
import { accountIdSchema, setUserAccessSchema } from "@/validators/stores";

export const Route = createFileRoute("/api/users/$id/access")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        withApiSession(request, async (session) => {
          const targetId = accountIdSchema.parse(params.id);
          const input = setUserAccessSchema.parse(await readJson(request));
          try {
            const result = await setUserAccess(
              session.user.id,
              targetId,
              input,
            );
            if (!result)
              throw new ApiError(404, "NOT_FOUND", "Pengguna tidak ditemukan.");
            return Response.json({ data: result });
          } catch (error) {
            if (error instanceof ForbiddenError)
              throw new ApiError(403, "FORBIDDEN", error.message);
            throw error;
          }
        }),
    },
  },
});
