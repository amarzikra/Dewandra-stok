import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { stores } from "./stores";
import { user } from "./user";

export const stockMovementTypes = [
  "in",
  "out",
  "return_in",
  "return_out",
  "adjustment",
] as const;

export type StockMovementType = (typeof stockMovementTypes)[number];

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).$type<StockMovementType>().notNull(),
    quantity: numeric("quantity", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    movementDate: date("movement_date", { mode: "string" }).notNull(),
    note: text("note").default("").notNull(),
    referenceId: uuid("reference_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    isVoid: boolean("is_void").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("stock_movements_store_date_idx").on(
      table.storeId,
      table.movementDate.desc(),
      table.createdAt.desc(),
    ),
    index("stock_movements_product_created_idx").on(
      table.productId,
      table.createdAt.desc(),
    ),
  ],
);
