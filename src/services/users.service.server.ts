import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/index.server";
import { stores, user, userStores } from "@/db/schema";
import { isOwnerRole, rolesOf } from "@/services/store-access.service.server";
import type {
  SetUserAccessInput,
  UpdateProfileInput,
} from "@/validators/stores";

export class ForbiddenError extends Error {
  constructor(message = "Hanya pemilik yang boleh mengelola pengguna.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("Email sudah dipakai akun lain.");
    this.name = "DuplicateEmailError";
  }
}

async function assertManager(userId: string) {
  const [account] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!account || !isOwnerRole(account.role)) throw new ForbiddenError();
}

export async function listUsers(userId: string) {
  await assertManager(userId);

  const accounts = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .orderBy(asc(user.name), asc(user.id));

  const grants = await db
    .select({
      userId: userStores.userId,
      storeId: userStores.storeId,
      accessLevel: userStores.accessLevel,
    })
    .from(userStores);

  return accounts.map((account) => {
    const access: Record<string, "view" | "edit"> = {};
    for (const grant of grants) {
      if (grant.userId === account.id)
        access[grant.storeId] = grant.accessLevel;
    }
    return { ...account, access };
  });
}

// The owner grants a staff account explicit rows. Setting rows also fixes the
// account's role to staff so removing every row revokes access instead of
// silently promoting them back to owner. Another owner may be restricted, but
// a global admin keeps its reach and cannot be demoted here.
export async function setUserAccess(
  userId: string,
  targetUserId: string,
  input: SetUserAccessInput,
) {
  await assertManager(userId);
  if (userId === targetUserId)
    throw new ForbiddenError("Akses akun sendiri tidak bisa dibatasi.");

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);
    if (!target) return null;
    if (rolesOf(target.role).includes("admin"))
      throw new ForbiddenError("Akses admin tidak bisa diubah dari sini.");

    const storeIds = input.access.map((entry) => entry.storeId);
    if (storeIds.length > 0) {
      const found = await tx
        .select({ id: stores.id })
        .from(stores)
        .where(inArray(stores.id, storeIds));
      if (found.length !== new Set(storeIds).size)
        throw new ForbiddenError("Sebagian toko tidak ditemukan.");
    }

    await tx.delete(userStores).where(eq(userStores.userId, targetUserId));
    if (input.access.length > 0)
      await tx.insert(userStores).values(
        input.access.map((entry) => ({
          userId: targetUserId,
          storeId: entry.storeId,
          accessLevel: entry.accessLevel,
        })),
      );

    await tx
      .update(user)
      .set({ role: "staff" })
      .where(eq(user.id, targetUserId));

    const access: Record<string, "view" | "edit"> = {};
    for (const entry of input.access) access[entry.storeId] = entry.accessLevel;
    return { id: targetUserId, role: "staff", access };
  });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (input.email) {
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, input.email), ne(user.id, userId)))
      .limit(1);
    if (existing) throw new DuplicateEmailError();
  }

  const [account] = await db
    .update(user)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    })
    .where(eq(user.id, userId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
    });

  return account ?? null;
}
