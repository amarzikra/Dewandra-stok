import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  DuplicateStoreCodeError,
  ForbiddenError,
  updateStore,
} from "@/services/stores.service.server";
import { inventoryIdSchema } from "@/validators/inventory";
import { updateStoreSchema } from "@/validators/stores";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export const Route = createFileRoute("/api/stores/$id")({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        withApiSession(request, async (session) => {
          const id = inventoryIdSchema.parse(params.id);
          const input = updateStoreSchema.parse(await readJson(request));
          try {
            const store = await updateStore(session.user.id, id, input);
            if (!store)
              throw new ApiError(404, "NOT_FOUND", "Toko tidak ditemukan.");
            return Response.json({ data: store });
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
