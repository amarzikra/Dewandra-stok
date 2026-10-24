import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Every resource an action can target. `defaultStatements` covers Better Auth's
// own user and session management; add a key per resource your app owns.
// Name actions for what they let someone do to *other people's* rows: owners
// already reach their own data through the session, so a role only has to grant
// the extra reach. Add a resource here first, then give roles a subset below.
export const statement = {
  ...defaultStatements,
  notes: ["read-any", "delete-any"],
} as const;

export const ac = createAccessControl(statement);

// A role is a subset of the statement. Keep app roles deliberately empty: the
// signed-in default should be able to do nothing beyond its own records.
// `owner` and `staff` gate the stock app's store-level access in
// src/services/store-access.service.server.ts, not the Better Auth statement.
export const roles = {
  owner: ac.newRole({ notes: [] }),
  staff: ac.newRole({ notes: [] }),
  user: ac.newRole({ notes: [] }),
  admin: ac.newRole({
    ...adminAc.statements,
    notes: ["read-any", "delete-any"],
  }),
} as const;

export type AppRole = keyof typeof roles;

// Roles live in the `user.role` column as a string. Better Auth reads a
// comma-separated list, so "admin,support" grants the union of both.
export const DEFAULT_ROLE = "owner" satisfies AppRole;
export const ADMIN_ROLES = ["admin"] satisfies AppRole[];

// The shape accepted by permission checks, e.g. { notes: ["read-any"] }.
export type Permissions = Partial<{
  [Resource in keyof typeof statement]: (typeof statement)[Resource][number][];
}>;
