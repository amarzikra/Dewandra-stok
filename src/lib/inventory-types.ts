export type StoreOption = {
  id: string;
  name: string;
  code: string;
};

export const productUnitOptions = [
  "pcs",
  "unit",
  "kg",
  "gram",
  "liter",
  "ml",
  "karung",
  "sak",
  "dus",
  "kotak",
  "pack",
  "rim",
  "lembar",
  "meter",
  "cm",
  "set",
  "batang",
  "roll",
  "lusin",
] as const;

export type StoreRecord = StoreOption & {
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt?: string;
};

export type ProductOption = {
  id: string;
  storeId: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
};

export type ProductRecord = ProductOption & {
  storeName: string;
  storeCode: string;
  purchasePrice: number;
  sellingPrice: number;
  category: string | null;
  isActive: boolean;
};

export type DailyMovement = {
  date: string;
  incoming: number;
  outgoing: number;
};

export type ProductSearchResult = ProductOption & {
  storeName: string;
  storeCode: string;
  purchasePrice: number;
  sellingPrice: number;
  category: string | null;
};

export type MovementType =
  "in" | "out" | "return_in" | "return_out" | "adjustment";

export type MovementRecord = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  type: MovementType;
  quantity: number;
  movementDate: string;
  note: string;
  referenceId: string | null;
  isVoid: boolean;
  createdAt: string;
};

export type ReturnType = "to_supplier" | "from_customer";

export type ReturnRecord = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  type: ReturnType;
  quantity: number;
  reason: string;
  returnDate: string;
  createdAt: string;
};

export type OpnameRecord = {
  id: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  opnameDate: string;
  status: "draft" | "selesai";
  note: string;
  itemCount: number;
  adjustmentCount: number;
  summary: string;
  createdAt: string;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  access: Record<string, "view" | "edit">;
};

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
    type: MovementType;
    quantity: number;
    note: string;
  }[];
};

export type Report = StockReport | MutationReport;

export type StockState = "out" | "low" | "ok";

export function stockState(currentStock: number, minStock: number): StockState {
  if (currentStock <= 0) return "out";
  if (minStock > 0 && currentStock < minStock) return "low";
  return "ok";
}

export function isLow(product: { currentStock: number; minStock: number }) {
  return product.minStock > 0 && product.currentStock < product.minStock;
}

export function isOut(product: { currentStock: number }) {
  return product.currentStock <= 0;
}
