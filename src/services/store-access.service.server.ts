import { asc, eq } from "drizzle-orm";
import { db } from "@/db/index.server";
import { stores, user, userStores } from "@/db/schema";

export type StoreAccess = {
  // Owners and admins reach every store and may manage stores, users, and access.
  isManager: boolean;
  // Every store this account may read. Managers get all stores.
  storeIds: string[];
  // Stores where this account may add or correct stock records.
  editableStoreIds: string[];
};

const OWNER_ROLES = new Set(["owner", "admin"]);

export function rolesOf(role: string | null | undefined) {
  return (role ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function isOwnerRole(role: string | null | undefined) {
  return rolesOf(role).some((name) => OWNER_ROLES.has(name));
}

// Owners reach every store. Staff reach only the stores listed in user_stores.
// Every stock page and API must ask this service before reading or writing.
export async function getStoreAccess(userId: string): Promise<StoreAccess> {
  const [account] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const storeRows = await db
    .select({ id: stores.id })
    .from(stores)
    .orderBy(asc(stores.name), asc(stores.id));

  if (isOwnerRole(account?.role)) {
    const all = storeRows.map((store) => store.id);
    return { isManager: true, storeIds: all, editableStoreIds: all };
  }

  const grants = await db
    .select({
      storeId: userStores.storeId,
      accessLevel: userStores.accessLevel,
    })
    .from(userStores)
    .where(eq(userStores.userId, userId));

  return {
    isManager: false,
    storeIds: grants.map((grant) => grant.storeId),
    editableStoreIds: grants
      .filter((grant) => grant.accessLevel === "edit")
      .map((grant) => grant.storeId),
  };
}

export function canReadStore(access: StoreAccess, storeId: string) {
  return access.storeIds.includes(storeId);
}

export function canEditStore(access: StoreAccess, storeId: string) {
  return access.editableStoreIds.includes(storeId);
}
