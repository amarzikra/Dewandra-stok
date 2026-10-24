import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  archiveProduct,
  DuplicateSkuError,
  updateProduct,
} from "@/services/products.service.server";
import { inventoryIdSchema, updateProductSchema } from "@/validators/inventory";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export const Route = createFileRoute("/api/products/$id")({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        withApiSession(request, async (session) => {
          const id = inventoryIdSchema.parse(params.id);
          const input = updateProductSchema.parse(await readJson(request));
          try {
            const product = await updateProduct(session.user.id, id, input);
            if (!product)
              throw new ApiError(
                404,
                "NOT_FOUND",
                "Barang tidak ditemukan di toko yang bisa kamu akses.",
              );
            return Response.json({ data: product });
          } catch (error) {
            if (error instanceof DuplicateSkuError || isUniqueViolation(error))
              throw new ApiError(
                409,
                "DUPLICATE_SKU",
                "Kode barang sudah dipakai di toko ini.",
              );
            throw error;
          }
        }),
      DELETE: ({ request, params }) =>
        withApiSession(request, async (session) => {
          const id = inventoryIdSchema.parse(params.id);
          const product = await archiveProduct(session.user.id, id);
          if (!product)
            throw new ApiError(
              404,
              "NOT_FOUND",
              "Barang tidak ditemukan di toko yang bisa kamu akses.",
            );
          return Response.json({ data: product });
        }),
    },
  },
});
