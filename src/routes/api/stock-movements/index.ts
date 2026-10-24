import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  ForbiddenStoreError,
  InsufficientStockError,
  listStockMovements,
  recordStockMovement,
} from "@/services/stock.service.server";
import {
  listStockMovementsSchema,
  recordStockMovementSchema,
} from "@/validators/inventory";

export const Route = createFileRoute("/api/stock-movements/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          const query = listStockMovementsSchema.parse(
            Object.fromEntries(new URL(request.url).searchParams),
          );
          return Response.json({
            data: await listStockMovements(session.user.id, query),
          });
        }),
      POST: ({ request }) =>
        withApiSession(request, async (session) => {
          const input = recordStockMovementSchema.parse(
            await readJson(request),
          );
          try {
            const result = await recordStockMovement(session.user.id, input);
            if (!result)
              throw new ApiError(404, "NOT_FOUND", "Barang tidak ditemukan.");
            return Response.json({ data: result }, { status: 201 });
          } catch (error) {
            if (error instanceof ForbiddenStoreError)
              throw new ApiError(403, "FORBIDDEN", error.message);
            if (error instanceof InsufficientStockError)
              throw new ApiError(422, "INSUFFICIENT_STOCK", error.message);
            throw error;
          }
        }),
    },
  },
});
