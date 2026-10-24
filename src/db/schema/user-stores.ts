import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { user } from "./user";

export const storeAccessLevels = ["view", "edit"] as const;

export type StoreAccessLevel = (typeof storeAccessLevels)[number];

export const userStores = pgTable(
  "user_stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    accessLevel: varchar("access_level", { length: 20 })
      .$type<StoreAccessLevel>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_stores_user_store_unique").on(
      table.userId,
      table.storeId,
    ),
    index("user_stores_store_idx").on(table.storeId),
  ],
);
