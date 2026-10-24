import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  createOpname,
  ForbiddenStoreError,
  InvalidOpnameError,
  listOpnames,
} from "@/services/opnames.service.server";
import { createOpnameSchema, listOpnamesSchema } from "@/validators/inventory";

export const Route = createFileRoute("/api/opnames/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          const query = listOpnamesSchema.parse(
            Object.fromEntries(new URL(request.url).searchParams),
          );
          return Response.json({
            data: await listOpnames(session.user.id, query),
          });
        }),
      POST: ({ request }) =>
        withApiSession(request, async (session) => {
          const input = createOpnameSchema.parse(await readJson(request));
          try {
            const result = await createOpname(session.user.id, input);
            if (!result)
              throw new ApiError(404, "NOT_FOUND", "Toko tidak ditemukan.");
            return Response.json({ data: result }, { status: 201 });
          } catch (error) {
            if (error instanceof ForbiddenStoreError)
              throw new ApiError(403, "FORBIDDEN", error.message);
            if (error instanceof InvalidOpnameError)
              throw new ApiError(422, "INVALID_OPNAME", error.message);
            throw error;
          }
        }),
    },
  },
});
