-- Accounts created before store access existed held the default "user" role.
-- Promote them to owner so they keep reaching the five stores. New accounts
-- receive "owner" or "staff" from src/lib/permissions.ts.
UPDATE "user" SET role = 'owner' WHERE role IS NULL OR role = 'user';
