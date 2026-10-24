import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  createProduct,
  DuplicateSkuError,
  ForbiddenStoreError,
  listProducts,
} from "@/services/products.service.server";
import {
  createProductSchema,
  listProductsSchema,
} from "@/validators/inventory";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export const Route = createFileRoute("/api/products/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withApiSession(request, async (session) => {
          const query = listProductsSchema.parse(
            Object.fromEntries(new URL(request.url).searchParams),
          );
          return Response.json({
            data: await listProducts(session.user.id, query),
          });
        }),
      POST: ({ request }) =>
        withApiSession(request, async (session) => {
          const input = createProductSchema.parse(await readJson(request));
          try {
            const product = await createProduct(session.user.id, input);
            if (!product)
              throw new ApiError(404, "NOT_FOUND", "Toko tidak ditemukan.");
            return Response.json({ data: product }, { status: 201 });
          } catch (error) {
            if (error instanceof ForbiddenStoreError)
              throw new ApiError(403, "FORBIDDEN", error.message);
            if (error instanceof DuplicateSkuError || isUniqueViolation(error))
              throw new ApiError(
                409,
                "DUPLICATE_SKU",
                "Kode barang sudah dipakai di toko ini.",
              );
            throw error;
          }
        }),
    },
  },
});
