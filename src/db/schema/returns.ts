import {
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

export const returnTypes = ["to_supplier", "from_customer"] as const;

export type ReturnType = (typeof returnTypes)[number];

export const returns = pgTable(
  "returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 20 }).$type<ReturnType>().notNull(),
    quantity: numeric("quantity", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    reason: text("reason").notNull(),
    returnDate: date("return_date", { mode: "string" }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("returns_store_date_idx").on(
      table.storeId,
      table.returnDate.desc(),
      table.createdAt.desc(),
    ),
    index("returns_product_idx").on(table.productId),
  ],
);
