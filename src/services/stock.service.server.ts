import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/index.server";
import { products, stockMovements, stores } from "@/db/schema";
import {
  canEditStore,
  getStoreAccess,
} from "@/services/store-access.service.server";
import type {
  ListStockMovementsInput,
  RecordStockMovementInput,
} from "@/validators/inventory";

export class InsufficientStockError extends Error {
  constructor(
    public productName: string,
    public available: number,
    public unit: string,
  ) {
    super(`Stok ${productName} tidak cukup. Tersedia ${available} ${unit}.`);
    this.name = "InsufficientStockError";
  }
}

export class ForbiddenStoreError extends Error {
  constructor() {
    super("Akun ini tidak boleh mencatat di toko tersebut.");
    this.name = "ForbiddenStoreError";
  }
}

export class InvalidMovementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMovementError";
  }
}

const movementFields = {
  id: stockMovements.id,
  productId: stockMovements.productId,
  productName: products.name,
  sku: products.sku,
  unit: products.unit,
  storeId: stockMovements.storeId,
  storeName: stores.name,
  storeCode: stores.code,
  type: stockMovements.type,
  quantity: stockMovements.quantity,
  movementDate: stockMovements.movementDate,
  note: stockMovements.note,
  referenceId: stockMovements.referenceId,
  isVoid: stockMovements.isVoid,
  createdBy: stockMovements.createdBy,
  createdAt: stockMovements.createdAt,
};

export async function listStockMovements(
  userId: string,
  { type, storeId, productId, from, to, limit }: ListStockMovementsInput,
) {
  const access = await getStoreAccess(userId);
  if (access.storeIds.length === 0) return [];
  if (storeId && !access.storeIds.includes(storeId)) return [];

  const filters = [inArray(stockMovements.storeId, access.storeIds)];
  if (type) filters.push(eq(stockMovements.type, type));
  if (storeId) filters.push(eq(stockMovements.storeId, storeId));
  if (productId) filters.push(eq(stockMovements.productId, productId));
  if (from) filters.push(gte(stockMovements.movementDate, from));
  if (to) filters.push(lte(stockMovements.movementDate, to));

  return db
    .select(movementFields)
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(stores, eq(stores.id, stockMovements.storeId))
    .where(and(...filters))
    .orderBy(
      desc(stockMovements.movementDate),
      desc(stockMovements.createdAt),
      desc(stockMovements.id),
    )
    .limit(limit);
}

export async function recordStockMovement(
  userId: string,
  input: RecordStockMovementInput,
) {
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

    if (input.type === "out" && product.currentStock < input.quantity)
      throw new InsufficientStockError(
        product.name,
        product.currentStock,
        product.unit,
      );

    const delta = input.type === "in" ? input.quantity : -input.quantity;

    await tx.insert(stockMovements).values({
      productId: product.id,
      storeId: product.storeId,
      type: input.type,
      quantity: input.quantity,
      movementDate: input.movementDate,
      note: input.note,
      createdBy: userId,
    });

    const [updated] = await tx
      .update(products)
      .set({ currentStock: sql`${products.currentStock} + ${delta}` })
      .where(eq(products.id, product.id))
      .returning({ currentStock: products.currentStock });

    return {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      type: input.type,
      quantity: input.quantity,
      currentStock: updated.currentStock,
    };
  });
}

// Cancelling a record never deletes history: the row stays visible as void and
// the stock is reversed in the same transaction.
export async function voidStockMovement(userId: string, movementId: string) {
  const access = await getStoreAccess(userId);

  return db.transaction(async (tx) => {
    const [movement] = await tx
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        storeId: stockMovements.storeId,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        isVoid: stockMovements.isVoid,
      })
      .from(stockMovements)
      .where(eq(stockMovements.id, movementId))
      .limit(1);
    if (!movement || movement.isVoid) return null;
    if (movement.type !== "in" && movement.type !== "out")
      throw new InvalidMovementError(
        "Hanya catatan barang masuk atau keluar yang bisa dibatalkan di sini.",
      );
    if (!canEditStore(access, movement.storeId))
      throw new ForbiddenStoreError();

    const [product] = await tx
      .select({
        id: products.id,
        name: products.name,
        unit: products.unit,
        currentStock: products.currentStock,
      })
      .from(products)
      .where(eq(products.id, movement.productId))
      .limit(1)
      .for("update");
    if (!product) return null;

    const delta =
      movement.type === "in" ? -movement.quantity : movement.quantity;
    const nextStock = product.currentStock + delta;
    if (nextStock < 0)
      throw new InsufficientStockError(
        product.name,
        product.currentStock,
        product.unit,
      );

    await tx
      .update(stockMovements)
      .set({ isVoid: true })
      .where(eq(stockMovements.id, movement.id));

    const [updated] = await tx
      .update(products)
      .set({ currentStock: nextStock })
      .where(eq(products.id, product.id))
      .returning({ currentStock: products.currentStock });

    return {
      id: movement.id,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      type: movement.type,
      quantity: movement.quantity,
      currentStock: updated.currentStock,
    };
  });
}
