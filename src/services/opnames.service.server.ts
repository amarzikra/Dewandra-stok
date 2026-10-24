import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/index.server";
import {
  products,
  stockMovements,
  stockOpnameItems,
  stockOpnames,
  stores,
} from "@/db/schema";
import {
  canEditStore,
  getStoreAccess,
} from "@/services/store-access.service.server";
import type {
  CreateOpnameInput,
  ListOpnamesInput,
} from "@/validators/inventory";

export class ForbiddenStoreError extends Error {
  constructor() {
    super("Akun ini tidak boleh mencatat di toko tersebut.");
    this.name = "ForbiddenStoreError";
  }
}

export class InvalidOpnameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOpnameError";
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function quantityLabel(value: number) {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export async function listOpnames(
  userId: string,
  { storeId, limit }: ListOpnamesInput,
) {
  const access = await getStoreAccess(userId);
  if (access.storeIds.length === 0) return [];
  if (storeId && !access.storeIds.includes(storeId)) return [];

  const filters = [inArray(stockOpnames.storeId, access.storeIds)];
  if (storeId) filters.push(eq(stockOpnames.storeId, storeId));

  const sessions = await db
    .select({
      id: stockOpnames.id,
      storeId: stockOpnames.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      opnameDate: stockOpnames.opnameDate,
      status: stockOpnames.status,
      note: stockOpnames.note,
      createdAt: stockOpnames.createdAt,
    })
    .from(stockOpnames)
    .innerJoin(stores, eq(stores.id, stockOpnames.storeId))
    .where(and(...filters))
    .orderBy(
      desc(stockOpnames.opnameDate),
      desc(stockOpnames.createdAt),
      desc(stockOpnames.id),
    )
    .limit(limit);

  if (sessions.length === 0) return [];

  const items = await db
    .select({
      opnameId: stockOpnameItems.opnameId,
      productName: products.name,
      unit: products.unit,
      difference: stockOpnameItems.difference,
    })
    .from(stockOpnameItems)
    .innerJoin(products, eq(products.id, stockOpnameItems.productId))
    .where(
      inArray(
        stockOpnameItems.opnameId,
        sessions.map((session) => session.id),
      ),
    );

  return sessions.map((session) => {
    const sessionItems = items.filter((item) => item.opnameId === session.id);
    const changed = sessionItems.filter(
      (item) => Math.abs(item.difference) > 0.0001,
    );
    return {
      ...session,
      itemCount: sessionItems.length,
      adjustmentCount: changed.length,
      summary: changed
        .map(
          (item) =>
            `${item.productName} ${item.difference > 0 ? "+" : "−"}${quantityLabel(Math.abs(item.difference))} ${item.unit}`,
        )
        .join(", "),
    };
  });
}

// Saves a completed opname session, its rincian, and one adjustment movement
// per difference. Products are locked so two counters cannot overwrite each other.
export async function createOpname(userId: string, input: CreateOpnameInput) {
  const access = await getStoreAccess(userId);
  if (!canEditStore(access, input.storeId)) throw new ForbiddenStoreError();

  return db.transaction(async (tx) => {
    const [store] = await tx
      .select({ id: stores.id, name: stores.name, isActive: stores.isActive })
      .from(stores)
      .where(eq(stores.id, input.storeId))
      .limit(1);
    if (!store || !store.isActive) return null;

    const ids = input.items.map((item) => item.productId);
    const productRows = await tx
      .select({
        id: products.id,
        name: products.name,
        unit: products.unit,
        currentStock: products.currentStock,
        isActive: products.isActive,
      })
      .from(products)
      .where(
        and(
          eq(products.storeId, input.storeId),
          inArray(products.id, ids),
          eq(products.isActive, true),
        ),
      )
      .for("update");

    if (productRows.length !== ids.length)
      throw new InvalidOpnameError(
        "Sebagian barang tidak ditemukan di toko ini. Muat ulang lalu coba lagi.",
      );

    const byId = new Map(productRows.map((row) => [row.id, row]));
    const rows = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      const systemQty = product.currentStock;
      const difference = round2(item.physicalQty - systemQty);
      return { product, systemQty, physicalQty: item.physicalQty, difference };
    });

    const [session] = await tx
      .insert(stockOpnames)
      .values({
        storeId: input.storeId,
        opnameDate: input.opnameDate,
        status: "selesai",
        note: input.note,
        createdBy: userId,
      })
      .returning({ id: stockOpnames.id });

    await tx.insert(stockOpnameItems).values(
      rows.map((row) => ({
        opnameId: session.id,
        productId: row.product.id,
        systemQty: row.systemQty,
        physicalQty: row.physicalQty,
        difference: row.difference,
        isAdjusted: row.difference !== 0,
      })),
    );

    const changed = rows.filter((row) => row.difference !== 0);
    for (const row of changed) {
      await tx
        .update(products)
        .set({ currentStock: row.physicalQty })
        .where(eq(products.id, row.product.id));

      await tx.insert(stockMovements).values({
        productId: row.product.id,
        storeId: input.storeId,
        type: "adjustment",
        quantity: row.difference,
        movementDate: input.opnameDate,
        note: input.note || "Hasil stock opname",
        referenceId: session.id,
        createdBy: userId,
      });
    }

    return {
      id: session.id,
      storeId: input.storeId,
      storeName: store.name,
      opnameDate: input.opnameDate,
      status: "selesai" as const,
      itemCount: rows.length,
      adjustmentCount: changed.length,
      summary: changed
        .map(
          (row) =>
            `${row.product.name} ${row.difference > 0 ? "+" : "−"}${quantityLabel(Math.abs(row.difference))} ${row.product.unit}`,
        )
        .join(", "),
    };
  });
}
