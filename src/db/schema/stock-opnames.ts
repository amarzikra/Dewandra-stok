import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { user } from "./user";

export const opnameStatuses = ["draft", "selesai"] as const;

export type OpnameStatus = (typeof opnameStatuses)[number];

export const stockOpnames = pgTable(
  "stock_opnames",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "restrict" }),
    opnameDate: date("opname_date", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 })
      .$type<OpnameStatus>()
      .default("selesai")
      .notNull(),
    note: text("note").default("").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("stock_opnames_store_date_idx").on(
      table.storeId,
      table.opnameDate.desc(),
      table.createdAt.desc(),
    ),
  ],
);
