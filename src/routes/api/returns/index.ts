import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  createReturn,
  ForbiddenStoreError,
  listReturns,
} from "@/services/returns.service.server";
import { InsufficientStockError } from "@/services/stock.service.server";
import { createReturnSchema, listReturnsSchema } from "@/validators/inventory";

export const Route = createFileRoute("/api/returns/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          const query = listReturnsSchema.parse(
            Object.fromEntries(new URL(request.url).searchParams),
          );
          return Response.json({
            data: await listReturns(session.user.id, query),
          });
        }),
      POST: ({ request }) =>
        withApiSession(request, async (session) => {
          const input = createReturnSchema.parse(await readJson(request));
          try {
            const result = await createReturn(session.user.id, input);
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
