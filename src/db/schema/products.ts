import {
  boolean,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    sku: varchar("sku", { length: 60 }),
    category: varchar("category", { length: 80 }),
    unit: varchar("unit", { length: 20 }).default("pcs").notNull(),
    price: numeric("price", { precision: 14, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    purchasePrice: numeric("purchase_price", {
      precision: 14,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    sellingPrice: numeric("selling_price", {
      precision: 14,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    minStock: numeric("min_stock", { precision: 14, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    currentStock: numeric("current_stock", {
      precision: 14,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("products_store_name_idx").on(table.storeId, table.name),
    uniqueIndex("products_store_sku_unique").on(table.storeId, table.sku),
  ],
);
