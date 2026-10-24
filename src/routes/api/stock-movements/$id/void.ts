import { createFileRoute } from "@tanstack/react-router";
import { ApiError, withApiSession } from "@/lib/api.server";
import {
  ForbiddenStoreError,
  InsufficientStockError,
  InvalidMovementError,
  voidStockMovement,
} from "@/services/stock.service.server";
import { inventoryIdSchema } from "@/validators/inventory";

export const Route = createFileRoute("/api/stock-movements/$id/void")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        withApiSession(request, async (session) => {
          const id = inventoryIdSchema.parse(params.id);
          try {
            const result = await voidStockMovement(session.user.id, id);
            if (!result)
              throw new ApiError(
                404,
                "NOT_FOUND",
                "Catatan tidak ditemukan atau sudah dibatalkan.",
              );
            return Response.json({ data: result });
          } catch (error) {
            if (error instanceof ForbiddenStoreError)
              throw new ApiError(403, "FORBIDDEN", error.message);
            if (error instanceof InsufficientStockError)
              throw new ApiError(422, "INSUFFICIENT_STOCK", error.message);
            if (error instanceof InvalidMovementError)
              throw new ApiError(422, "INVALID_MOVEMENT", error.message);
            throw error;
          }
        }),
    },
  },
});
