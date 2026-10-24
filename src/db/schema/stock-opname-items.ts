import {
  boolean,
  index,
  numeric,
  pgTable,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { stockOpnames } from "./stock-opnames";

export const stockOpnameItems = pgTable(
  "stock_opname_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opnameId: uuid("opname_id")
      .notNull()
      .references(() => stockOpnames.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    systemQty: numeric("system_qty", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    physicalQty: numeric("physical_qty", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    difference: numeric("difference", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    isAdjusted: boolean("is_adjusted").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("stock_opname_items_session_product_unique").on(
      table.opnameId,
      table.productId,
    ),
    index("stock_opname_items_product_idx").on(table.productId),
  ],
);
