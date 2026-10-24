import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/index.server";
import { products, returns, stockMovements, stores } from "@/db/schema";
import { InsufficientStockError } from "@/services/stock.service.server";
import {
  canEditStore,
  getStoreAccess,
} from "@/services/store-access.service.server";
import type {
  CreateReturnInput,
  ListReturnsInput,
} from "@/validators/inventory";

export class ForbiddenStoreError extends Error {
  constructor() {
    super("Akun ini tidak boleh mencatat di toko tersebut.");
    this.name = "ForbiddenStoreError";
  }
}

const returnFields = {
  id: returns.id,
  productId: returns.productId,
  productName: products.name,
  sku: products.sku,
  unit: products.unit,
  storeId: returns.storeId,
  storeName: stores.name,
  storeCode: stores.code,
  type: returns.type,
  quantity: returns.quantity,
  reason: returns.reason,
  returnDate: returns.returnDate,
  createdBy: returns.createdBy,
  createdAt: returns.createdAt,
};

export async function listReturns(
  userId: string,
  { storeId, limit }: ListReturnsInput,
) {
  const access = await getStoreAccess(userId);
  if (access.storeIds.length === 0) return [];
  if (storeId && !access.storeIds.includes(storeId)) return [];

  const filters = [inArray(returns.storeId, access.storeIds)];
  if (storeId) filters.push(eq(returns.storeId, storeId));

  return db
    .select(returnFields)
    .from(returns)
    .innerJoin(products, eq(products.id, returns.productId))
    .innerJoin(stores, eq(stores.id, returns.storeId))
    .where(and(...filters))
    .orderBy(
      desc(returns.returnDate),
      desc(returns.createdAt),
      desc(returns.id),
    )
    .limit(limit);
}

// A return always writes its own row plus one stock movement, so the mutation
// report and the return history can never drift apart.
export async function createReturn(userId: string, input: CreateReturnInput) {
  const access = await getStoreAccess(userId);

  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({
        id: products.id,
        name: products.name,
        unit: products.unit,
        storeId: products.storeId,
        isActive: products.isActive,
        currentStock: products.currentStock,
      })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1)
      .for("update");
    if (!product || !product.isActive) return null;

    const [store] = await tx
      .select({ isActive: stores.isActive })
      .from(stores)
      .where(eq(stores.id, product.storeId))
      .limit(1);
    if (!store?.isActive) return null;

    if (!canEditStore(access, product.storeId)) throw new ForbiddenStoreError();

    if (input.type === "to_supplier" && product.currentStock < input.quantity)
      throw new InsufficientStockError(
        product.name,
        product.currentStock,
        product.unit,
      );

    const [returned] = await tx
      .insert(returns)
      .values({
        productId: product.id,
        storeId: product.storeId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        returnDate: input.returnDate,
        createdBy: userId,
      })
      .returning({ id: returns.id });

    const delta =
      input.type === "to_supplier" ? -input.quantity : input.quantity;

    await tx.insert(stockMovements).values({
      productId: product.id,
      storeId: product.storeId,
      type: input.type === "to_supplier" ? "return_out" : "return_in",
      quantity: input.quantity,
      movementDate: input.returnDate,
      note: input.reason,
      referenceId: returned.id,
      createdBy: userId,
    });

    const [updated] = await tx
      .update(products)
      .set({ currentStock: sql`${products.currentStock} + ${delta}` })
      .where(eq(products.id, product.id))
      .returning({ currentStock: products.currentStock });

    return {
      id: returned.id,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      type: input.type,
      quantity: input.quantity,
      currentStock: updated.currentStock,
    };
  });
}
