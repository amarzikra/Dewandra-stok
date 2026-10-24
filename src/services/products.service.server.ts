import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/index.server";
import { products, stores } from "@/db/schema";
import {
  canEditStore,
  getStoreAccess,
  type StoreAccess,
} from "@/services/store-access.service.server";
import type {
  CreateProductInput,
  ListProductsInput,
  UpdateProductInput,
} from "@/validators/inventory";

export class DuplicateSkuError extends Error {
  constructor() {
    super("Kode barang sudah dipakai di toko ini.");
    this.name = "DuplicateSkuError";
  }
}

export class ForbiddenStoreError extends Error {
  constructor() {
    super("Akun ini tidak boleh mencatat di toko tersebut.");
    this.name = "ForbiddenStoreError";
  }
}

const productColumns = {
  id: products.id,
  storeId: products.storeId,
  name: products.name,
  sku: products.sku,
  category: products.category,
  unit: products.unit,
  purchasePrice: products.purchasePrice,
  sellingPrice: products.sellingPrice,
  minStock: products.minStock,
  currentStock: products.currentStock,
  isActive: products.isActive,
};

const productFields = {
  ...productColumns,
  storeName: stores.name,
  storeCode: stores.code,
};

function storeFilter(access: StoreAccess) {
  return inArray(products.storeId, access.storeIds);
}

async function findStore(storeId: string) {
  const [store] = await db
    .select({ id: stores.id, name: stores.name, code: stores.code })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.isActive, true)))
    .limit(1);
  return store ?? null;
}

async function skuTaken(storeId: string, sku: string, exceptId?: string) {
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.sku, sku)))
    .limit(1);
  return Boolean(existing && existing.id !== exceptId);
}

export async function listProducts(
  userId: string,
  { q, storeId, status, limit }: ListProductsInput,
) {
  const access = await getStoreAccess(userId);
  if (access.storeIds.length === 0) return [];
  if (storeId && !access.storeIds.includes(storeId)) return [];

  const filters = [
    storeFilter(access),
    eq(products.isActive, true),
    eq(stores.isActive, true),
  ];
  if (storeId) filters.push(eq(products.storeId, storeId));
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const match = or(
      ilike(products.name, pattern),
      ilike(products.sku, pattern),
    );
    if (match) filters.push(match);
  }
  if (status === "out") filters.push(sql`${products.currentStock} <= 0`);
  if (status === "low")
    filters.push(
      sql`${products.minStock} > 0 and ${products.currentStock} < ${products.minStock}`,
    );
  if (status === "ok")
    filters.push(
      sql`${products.currentStock} > 0 and (${products.minStock} <= 0 or ${products.currentStock} >= ${products.minStock})`,
    );

  return db
    .select(productFields)
    .from(products)
    .innerJoin(stores, eq(stores.id, products.storeId))
    .where(and(...filters))
    .orderBy(asc(stores.name), asc(products.name), asc(products.id))
    .limit(limit);
}

export async function createProduct(userId: string, input: CreateProductInput) {
  const access = await getStoreAccess(userId);
  if (!canEditStore(access, input.storeId)) throw new ForbiddenStoreError();
  const store = await findStore(input.storeId);
  if (!store) return null;

  if (input.sku && (await skuTaken(input.storeId, input.sku)))
    throw new DuplicateSkuError();

  const [product] = await db
    .insert(products)
    .values({
      storeId: input.storeId,
      name: input.name,
      sku: input.sku ?? null,
      category: input.category ?? null,
      unit: input.unit,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      minStock: input.minStock,
    })
    .returning(productColumns);

  return { ...product, storeName: store.name, storeCode: store.code };
}

export async function updateProduct(
  userId: string,
  productId: string,
  input: UpdateProductInput,
) {
  const access = await getStoreAccess(userId);
  const [existing] = await db
    .select({ id: products.id, storeId: products.storeId, sku: products.sku })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!existing || !canEditStore(access, existing.storeId)) return null;

  const targetStoreId = input.storeId ?? existing.storeId;
  if (!canEditStore(access, targetStoreId)) return null;
  const store = await findStore(targetStoreId);
  if (!store) return null;

  const targetSku = input.sku === undefined ? existing.sku : input.sku;
  if (targetSku && (await skuTaken(targetStoreId, targetSku, productId)))
    throw new DuplicateSkuError();

  const patch: Record<string, unknown> = {};
  if (input.storeId !== undefined) patch.storeId = input.storeId;
  if (input.name !== undefined) patch.name = input.name;
  if (input.sku !== undefined) patch.sku = input.sku;
  if (input.category !== undefined) patch.category = input.category;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.purchasePrice !== undefined) patch.purchasePrice = input.purchasePrice;
  if (input.sellingPrice !== undefined) patch.sellingPrice = input.sellingPrice;
  if (input.minStock !== undefined) patch.minStock = input.minStock;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const [product] = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, productId))
    .returning(productColumns);

  return { ...product, storeName: store.name, storeCode: store.code };
}

// Archive keeps the row and its movement history instead of deleting it.
export async function archiveProduct(userId: string, productId: string) {
  const access = await getStoreAccess(userId);
  const [existing] = await db
    .select({ id: products.id, storeId: products.storeId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!existing || !canEditStore(access, existing.storeId)) return null;

  const store = await findStore(existing.storeId);
  if (!store) return null;

  const [product] = await db
    .update(products)
    .set({ isActive: false })
    .where(eq(products.id, productId))
    .returning(productColumns);

  return { ...product, storeName: store.name, storeCode: store.code };
}
