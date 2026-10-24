import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db/index.server";
import { products, stockMovements, stores } from "@/db/schema";
import type { DailyMovement } from "@/lib/inventory-types";
import { getStoreAccess } from "@/services/store-access.service.server";

export type DashboardStore = {
  id: string;
  name: string;
  code: string;
  productCount: number;
  stockValue: number;
  lowStockCount: number;
};

export type LowStockProduct = {
  id: string;
  storeId: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  storeName: string;
  storeCode: string;
};

export type RecentMovement = {
  id: string;
  type: string;
  quantity: number;
  unit: string;
  movementDate: string;
  productName: string;
  storeName: string;
  storeCode: string;
  createdAt: string;
};

export type DashboardData = {
  generatedAt: string;
  stores: DashboardStore[];
  totals: {
    productCount: number;
    stockValue: number;
    lowStockCount: number;
  };
  dailyMovements: DailyMovement[];
  lowStock: LowStockProduct[];
  recent: RecentMovement[];
};

function localDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const access = await getStoreAccess(userId);
  const allowed = access.storeIds;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return localDateString(date);
  });
  const empty: DashboardData = {
    generatedAt: new Date().toISOString(),
    stores: [],
    totals: { productCount: 0, stockValue: 0, lowStockCount: 0 },
    dailyMovements: days.map((date) => ({
      date,
      incoming: 0,
      outgoing: 0,
    })),
    lowStock: [],
    recent: [],
  };
  if (allowed.length === 0) return empty;

  const activeProducts = and(
    eq(products.isActive, true),
    eq(stores.isActive, true),
  );

  const storeRows = await db
    .select({
      id: stores.id,
      name: stores.name,
      code: stores.code,
      productCount: count(products.id),
      stockValue: sql<string>`coalesce(sum(${products.purchasePrice} * ${products.currentStock}), 0)`,
      lowStockCount: sql<number>`cast(count(*) filter (where ${products.minStock} > 0 and ${products.currentStock} < ${products.minStock}) as int)`,
    })
    .from(stores)
    .leftJoin(
      products,
      and(eq(products.storeId, stores.id), eq(products.isActive, true)),
    )
    .where(and(inArray(stores.id, allowed), eq(stores.isActive, true)))
    .groupBy(stores.id, stores.name, stores.code)
    .orderBy(asc(stores.name), asc(stores.id));

  const lowStockRows = await db
    .select({
      id: products.id,
      storeId: products.storeId,
      name: products.name,
      sku: products.sku,
      unit: products.unit,
      currentStock: products.currentStock,
      minStock: products.minStock,
      storeName: stores.name,
      storeCode: stores.code,
    })
    .from(products)
    .innerJoin(stores, eq(stores.id, products.storeId))
    .where(
      and(
        activeProducts,
        inArray(products.storeId, allowed),
        gt(products.minStock, 0),
        sql`${products.currentStock} < ${products.minStock}`,
      ),
    )
    .orderBy(asc(products.currentStock), asc(products.name), asc(products.id))
    .limit(8);

  const recentRows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      unit: products.unit,
      movementDate: stockMovements.movementDate,
      productName: products.name,
      storeName: stores.name,
      storeCode: stores.code,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(stores, eq(stores.id, stockMovements.storeId))
    .where(
      and(
        eq(stockMovements.isVoid, false),
        inArray(stockMovements.storeId, allowed),
      ),
    )
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(5);

  const dailyRows = await db
    .select({
      date: stockMovements.movementDate,
      type: stockMovements.type,
      quantity: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)`,
    })
    .from(stockMovements)
    .where(
      and(
        inArray(stockMovements.storeId, allowed),
        eq(stockMovements.isVoid, false),
        inArray(stockMovements.type, ["in", "out"]),
        gte(stockMovements.movementDate, days[0]),
        lte(stockMovements.movementDate, days[days.length - 1]),
      ),
    )
    .groupBy(stockMovements.movementDate, stockMovements.type);

  const dailyByDate = new Map(
    days.map((date) => [date, { date, incoming: 0, outgoing: 0 }]),
  );
  for (const row of dailyRows) {
    const entry = dailyByDate.get(row.date);
    if (!entry) continue;
    if (row.type === "in") entry.incoming += Number(row.quantity);
    if (row.type === "out") entry.outgoing += Number(row.quantity);
  }

  const storeSummaries: DashboardStore[] = storeRows.map((row) => ({
    ...row,
    stockValue: Number(row.stockValue ?? 0),
  }));

  const totals = storeSummaries.reduce(
    (sum, store) => ({
      productCount: sum.productCount + store.productCount,
      stockValue: sum.stockValue + store.stockValue,
      lowStockCount: sum.lowStockCount + store.lowStockCount,
    }),
    { productCount: 0, stockValue: 0, lowStockCount: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    stores: storeSummaries,
    totals,
    dailyMovements: days.map((date) => dailyByDate.get(date)!),
    lowStock: lowStockRows,
    recent: recentRows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
