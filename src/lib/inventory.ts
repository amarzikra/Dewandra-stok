import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getSession } from "@/lib/session.server";
import { getDashboard } from "@/services/dashboard.service.server";

// Called from the guarded /app loader. It still verifies the session so the
// data read is never available without an account.
export const getDashboardFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession(getRequestHeaders() as unknown as Headers);
    if (!session) throw new Error("Sign in to view the dashboard.");
    return getDashboard(session.user.id);
  },
);

export type DashboardResult = Awaited<ReturnType<typeof getDashboardFn>>;
