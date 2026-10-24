import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChartLine,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { useLowCount } from "@/lib/stock-app-store";
import { siteConfig } from "@/config/site";

type NavItem = {
  to:
    | "/app"
    | "/app/barang"
    | "/app/masuk"
    | "/app/keluar"
    | "/app/retur"
    | "/app/opname"
    | "/app/laporan"
    | "/app/pengaturan";
  label: string;
  crumb: string;
  icon: LucideIcon;
};

const operationalNav: NavItem[] = [
  { to: "/app", label: "Dashboard", crumb: "Dashboard", icon: LayoutDashboard },
  {
    to: "/app/barang",
    label: "Barang",
    crumb: "Katalog barang",
    icon: Package,
  },
  {
    to: "/app/masuk",
    label: "Barang masuk",
    crumb: "Barang masuk",
    icon: ArrowDownToLine,
  },
  {
    to: "/app/keluar",
    label: "Barang keluar",
    crumb: "Barang keluar",
    icon: ArrowUpFromLine,
  },
  { to: "/app/retur", label: "Retur", crumb: "Retur barang", icon: RotateCcw },
  {
    to: "/app/opname",
    label: "Stock opname",
    crumb: "Stock opname",
    icon: ClipboardCheck,
  },
];

const otherNav: NavItem[] = [
  { to: "/app/laporan", label: "Laporan", crumb: "Laporan", icon: ChartLine },
  {
    to: "/app/pengaturan",
    label: "Pengaturan",
    crumb: "Pengaturan",
    icon: Settings,
  },
];

const allNav = [...operationalNav, ...otherNav];

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="ss-link"
      activeOptions={{ exact: true }}
      activeProps={{ "aria-current": "page" }}
    >
      <Icon aria-hidden="true" />
      <span className="ss-link-label">{item.label}</span>
    </Link>
  );
}

export function StockShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const lowCount = useLowCount();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const current = allNav.find((item) => item.to === pathname);

  return (
    <div className="stock-app ss-shell">
      <aside className="ss-sidebar" aria-label="Sidebar Dewandra Stok">
        <Link
          to="/app"
          className="ss-brand"
          aria-label={`${siteConfig.name} - dashboard`}
        >
          <span className="ss-logo" aria-hidden="true">
            <Package />
          </span>
          <span className="ss-brand-name">{siteConfig.name}</span>
          <span className="ss-brand-pill">5 toko</span>
        </Link>

        <nav className="ss-nav" aria-label="Navigasi stok">
          <p className="ss-nav-group">Operasional</p>
          {operationalNav.map((item) => (
            <NavLink key={item.to} item={item} />
          ))}
          <p className="ss-nav-group">Lainnya</p>
          {otherNav.map((item) => (
            <NavLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="ss-restock">
          <p className="ss-restock-title">
            <TriangleAlert aria-hidden="true" />
            Perlu restock
          </p>
          <p className="ss-restock-count">
            <span>{lowCount}</span>{" "}
            <span className="ss-restock-unit">barang</span>
          </p>
          <Link to="/app" className="ss-btn ss-btn-outline ss-btn-sm">
            Lihat daftar
          </Link>
        </div>
      </aside>

      <div className="ss-workspace">
        <header className="ss-topbar">
          <div className="ss-topbar-inner">
            <p className="ss-breadcrumb">{current?.crumb ?? "Dashboard"}</p>
            <div className="ss-user">
              <span className="ss-user-copy">
                <span className="ss-user-label">Masuk sebagai</span>
                <span className="ss-user-name">{userName}</span>
              </span>
              <span className="ss-avatar" aria-hidden="true">
                <UserRound />
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="ss-main"
          aria-label="Konten halaman stok"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
