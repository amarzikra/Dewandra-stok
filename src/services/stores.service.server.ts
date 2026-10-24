import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/index.server";
import { stores, user } from "@/db/schema";
import {
  getStoreAccess,
  isOwnerRole,
} from "@/services/store-access.service.server";
import type { CreateStoreInput, UpdateStoreInput } from "@/validators/stores";

export class DuplicateStoreCodeError extends Error {
  constructor() {
    super("Kode toko sudah dipakai.");
    this.name = "DuplicateStoreCodeError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Hanya pemilik yang boleh mengelola toko.") {
    super(message);
    this.name = "ForbiddenError";
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

async function codeTaken(code: string, exceptId?: string) {
  const [existing] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.code, code))
    .limit(1);
  return Boolean(existing && existing.id !== exceptId);
}

export async function listStores(userId: string) {
  const access = await getStoreAccess(userId);
  if (access.storeIds.length === 0) return [];

  return db
    .select({
      id: stores.id,
      name: stores.name,
      code: stores.code,
      address: stores.address,
      phone: stores.phone,
      isActive: stores.isActive,
      createdAt: stores.createdAt,
    })
    .from(stores)
    .where(inArray(stores.id, access.storeIds))
    .orderBy(asc(stores.name), asc(stores.id));
}

export async function listActiveStores() {
  return db
    .select({ id: stores.id, name: stores.name, code: stores.code })
    .from(stores)
    .where(eq(stores.isActive, true))
    .orderBy(asc(stores.name), asc(stores.id));
}

export async function createStore(userId: string, input: CreateStoreInput) {
  await assertManager(userId);
  if (await codeTaken(input.code)) throw new DuplicateStoreCodeError();

  const [store] = await db
    .insert(stores)
    .values({
      name: input.name,
      code: input.code,
      address: input.address ?? null,
      phone: input.phone ?? null,
      isActive: input.isActive,
    })
    .returning({
      id: stores.id,
      name: stores.name,
      code: stores.code,
      address: stores.address,
      phone: stores.phone,
      isActive: stores.isActive,
    });

  return store;
}

export async function updateStore(
  userId: string,
  storeId: string,
  input: UpdateStoreInput,
) {
  await assertManager(userId);

  if (input.code && (await codeTaken(input.code, storeId)))
    throw new DuplicateStoreCodeError();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.code !== undefined) patch.code = input.code;
  if (input.address !== undefined) patch.address = input.address;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const [store] = await db
    .update(stores)
    .set(patch)
    .where(eq(stores.id, storeId))
    .returning({
      id: stores.id,
      name: stores.name,
      code: stores.code,
      address: stores.address,
      phone: stores.phone,
      isActive: stores.isActive,
    });

  return store ?? null;
}
