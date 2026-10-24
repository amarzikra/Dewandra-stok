import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  createStore,
  DuplicateStoreCodeError,
  ForbiddenError,
  listStores,
} from "@/services/stores.service.server";
import { createStoreSchema } from "@/validators/stores";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export const Route = createFileRoute("/api/stores/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          return Response.json({
            data: await listStores(session.user.id),
          });
        }),
      POST: ({ request }) =>
        withApiSession(request, async (session) => {
          const input = createStoreSchema.parse(await readJson(request));
          try {
            return Response.json(
              { data: await createStore(session.user.id, input) },
              { status: 201 },
            );
          } catch (error) {
            if (error instanceof ForbiddenError)
              throw new ApiError(403, "FORBIDDEN", error.message);
            if (
              error instanceof DuplicateStoreCodeError ||
              isUniqueViolation(error)
            )
              throw new ApiError(
                409,
                "DUPLICATE_STORE_CODE",
                "Kode toko sudah dipakai.",
              );
            throw error;
          }
        }),
    },
  },
});
