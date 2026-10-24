import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StockShell } from "@/components/stock-app/stock-shell";
import stockAppCss from "@/styles/stock-app.css?url";

export const Route = createFileRoute("/_protected/app")({
  head: () => ({
    links: [
      { rel: "stylesheet", href: stockAppCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();

  return (
    <StockShell userName={session.user.name}>
      <Outlet />
    </StockShell>
  );
}
