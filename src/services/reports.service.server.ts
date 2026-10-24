import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/index.server";
import { products, stockMovements, stores } from "@/db/schema";
import { getStoreAccess } from "@/services/store-access.service.server";
import type { ReportInput } from "@/validators/inventory";

export type StockReportItem = {
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  price: number;
  sold: number;
  currentStock: number;
  lastOutDate: string | null;
};

export type StockReport = {
  type: "stock";
  generatedAt: string;
  period: { from: string; to: string };
  stores: {
    id: string;
    name: string;
    code: string;
    itemCount: number;
    stockValue: number;
    lowStockCount: number;
    items: StockReportItem[];
  }[];
  totals: {
    itemCount: number;
    stockValue: number;
    lowStockCount: number;
    sold: number;
  };
};

export type MutationReport = {
  type: "mutation";
  generatedAt: string;
  movements: {
    id: string;
    movementDate: string;
    productId: string;
    productName: string;
    sku: string | null;
    unit: string;
    storeId: string;
    storeName: string;
    storeCode: string;
    type: string;
    quantity: number;
    note: string;
  }[];
};

export type Report = StockReport | MutationReport;

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

async function stockReport(
  storeIds: string[],
  { storeId, from, to }: { storeId?: string; from?: string; to?: string },
): Promise<StockReport> {
  const dateFrom = from ?? to ?? todayIso();
  const dateTo = to ?? from ?? todayIso();
  const period = { from: dateFrom, to: dateTo };

  if (storeIds.length === 0)
    return {
      type: "stock",
      generatedAt: new Date().toISOString(),
      period,
      stores: [],
      totals: { itemCount: 0, stockValue: 0, lowStockCount: 0, sold: 0 },
    };

  const filters = [inArray(stores.id, storeIds), eq(stores.isActive, true)];
  if (storeId) filters.push(eq(stores.id, storeId));

  const rows = await db
    .select({
      id: stores.id,
      name: stores.name,
      code: stores.code,
      itemCount: count(products.id),
      stockValue: sql<string>`coalesce(sum(${products.purchasePrice} * ${products.currentStock}), 0)`,
      lowStockCount: sql<number>`cast(count(*) filter (where ${products.minStock} > 0 and ${products.currentStock} < ${products.minStock}) as int)`,
    })
    .from(stores)
    .leftJoin(
      products,
      and(eq(products.storeId, stores.id), eq(products.isActive, true)),
    )
    .where(and(...filters))
    .groupBy(stores.id, stores.name, stores.code)
    .orderBy(asc(stores.name), asc(stores.id));

  const itemFilters = [
    inArray(products.storeId, storeIds),
    eq(products.isActive, true),
    eq(stores.isActive, true),
  ];
  if (storeId) itemFilters.push(eq(products.storeId, storeId));

  // `out` rows in the selected period are the products sold for that store.
  // Voided rows are excluded so a cancelled sale never appears in the report.
  const itemRows = await db
    .select({
      storeId: products.storeId,
      productId: products.id,
      name: products.name,
      sku: products.sku,
      unit: products.unit,
      price: products.purchasePrice,
      currentStock: products.currentStock,
      sold: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)`,
      lastOutDate: sql<string | null>`max(${stockMovements.movementDate})`,
    })
    .from(products)
    .innerJoin(stores, eq(stores.id, products.storeId))
    .leftJoin(
      stockMovements,
      and(
        eq(stockMovements.productId, products.id),
        eq(stockMovements.type, "out"),
        eq(stockMovements.isVoid, false),
        gte(stockMovements.movementDate, dateFrom),
        lte(stockMovements.movementDate, dateTo),
      ),
    )
    .where(and(...itemFilters))
    .groupBy(
      products.storeId,
      stores.id,
      stores.name,
      products.id,
      products.name,
      products.sku,
      products.unit,
      products.purchasePrice,
      products.currentStock,
    )
    .orderBy(asc(stores.name), asc(products.name), asc(products.id));

  const summaries = rows.map((row) => {
    const items: StockReportItem[] = itemRows
      .filter((item) => item.storeId === row.id)
      .map((item) => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        price: item.price,
        sold: Number(item.sold ?? 0),
        currentStock: item.currentStock,
        lastOutDate: item.lastOutDate ?? null,
      }));
    return {
      ...row,
      itemCount: Number(row.itemCount),
      stockValue: Number(row.stockValue ?? 0),
      lowStockCount: Number(row.lowStockCount ?? 0),
      items,
    };
  });

  return {
    type: "stock",
    generatedAt: new Date().toISOString(),
    period,
    stores: summaries,
    totals: summaries.reduce(
      (sum, row) => ({
        itemCount: sum.itemCount + row.itemCount,
        stockValue: sum.stockValue + row.stockValue,
        lowStockCount: sum.lowStockCount + row.lowStockCount,
        sold:
          sum.sold + row.items.reduce((total, item) => total + item.sold, 0),
      }),
      { itemCount: 0, stockValue: 0, lowStockCount: 0, sold: 0 },
    ),
  };
}

async function mutationReport(
  storeIds: string[],
  { storeId, from, to }: { storeId?: string; from?: string; to?: string },
): Promise<MutationReport> {
  if (storeIds.length === 0)
    return {
      type: "mutation",
      generatedAt: new Date().toISOString(),
      movements: [],
    };

  const filters = [
    inArray(stockMovements.storeId, storeIds),
    eq(stockMovements.isVoid, false),
  ];
  if (storeId) filters.push(eq(stockMovements.storeId, storeId));
  if (from) filters.push(gte(stockMovements.movementDate, from));
  if (to) filters.push(lte(stockMovements.movementDate, to));

  const rows = await db
    .select({
      id: stockMovements.id,
      movementDate: stockMovements.movementDate,
      productId: stockMovements.productId,
      productName: products.name,
      sku: products.sku,
      unit: products.unit,
      storeId: stockMovements.storeId,
      storeName: stores.name,
      storeCode: stores.code,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      note: stockMovements.note,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(stores, eq(stores.id, stockMovements.storeId))
    .where(and(...filters))
    .orderBy(
      desc(stockMovements.movementDate),
      desc(stockMovements.createdAt),
      desc(stockMovements.id),
    )
    .limit(1000);

  return {
    type: "mutation",
    generatedAt: new Date().toISOString(),
    movements: rows,
  };
}

export async function getReport(
  userId: string,
  input: ReportInput,
): Promise<Report> {
  const access = await getStoreAccess(userId);
  if (input.storeId && !access.storeIds.includes(input.storeId))
    return input.type === "stock"
      ? {
          type: "stock",
          generatedAt: new Date().toISOString(),
          period: {
            from: input.from ?? input.to ?? todayIso(),
            to: input.to ?? input.from ?? todayIso(),
          },
          stores: [],
          totals: { itemCount: 0, stockValue: 0, lowStockCount: 0, sold: 0 },
        }
      : {
          type: "mutation",
          generatedAt: new Date().toISOString(),
          movements: [],
        };

  if (input.type === "stock") return stockReport(access.storeIds, input);
  return mutationReport(access.storeIds, input);
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function csvRows(rows: (string | number)[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function reportCsv(report: Report) {
  if (report.type === "stock") {
    const rows: (string | number)[][] = [
      [
        "Toko",
        "Tanggal",
        "Barang",
        "Kode",
        "Terjual",
        "Satuan",
        "Sisa stok",
        "Nilai stok",
      ],
    ];
    for (const store of report.stores) {
      if (store.items.length === 0) {
        rows.push([
          store.name,
          report.period.to,
          "Belum ada barang",
          "",
          0,
          "",
          0,
          0,
        ]);
        continue;
      }
      for (const item of store.items) {
        rows.push([
          store.name,
          item.lastOutDate ?? report.period.to,
          item.name,
          item.sku ?? "",
          item.sold,
          item.unit,
          item.currentStock,
          item.price * item.currentStock,
        ]);
      }
    }
    rows.push([
      "Total",
      "",
      "",
      "",
      report.totals.sold,
      "",
      `${report.totals.itemCount} barang`,
      report.totals.stockValue,
    ]);
    return { filename: "laporan-stok.csv", csv: csvRows(rows) };
  }

  const labels: Record<string, string> = {
    in: "Masuk",
    out: "Keluar",
    return_in: "Retur masuk",
    return_out: "Retur keluar",
    adjustment: "Penyesuaian",
  };
  const rows: (string | number)[][] = [
    [
      "Tanggal",
      "Barang",
      "Kode",
      "Toko",
      "Jenis",
      "Jumlah",
      "Satuan",
      "Keterangan",
    ],
    ...report.movements.map((movement) => {
      const negative =
        movement.type === "out" ||
        movement.type === "return_out" ||
        movement.quantity < 0;
      return [
        movement.movementDate,
        movement.productName,
        movement.sku ?? "",
        movement.storeName,
        labels[movement.type] ?? movement.type,
        `${negative ? "-" : "+"}${Math.abs(movement.quantity)}`,
        movement.unit,
        movement.note,
      ];
    }),
  ];
  return { filename: "laporan-mutasi.csv", csv: csvRows(rows) };
}
