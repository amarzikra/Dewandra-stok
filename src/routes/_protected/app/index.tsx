import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  Check,
  CircleCheck,
  Package,
  PackagePlus,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovementDialog } from "@/components/inventory/movement-dialog";
import { ProductDialog } from "@/components/inventory/product-dialog";
import { ProductSearch } from "@/components/inventory/product-search";
import { StockFlowChart } from "@/components/inventory/stock-flow-chart";
import { StockStatusBadge } from "@/components/inventory/stock-status-badge";
import { siteConfig } from "@/config/site";
import {
  formatDateOnly,
  formatLongDate,
  formatQuantity,
  formatRupiah,
} from "@/lib/format";
import { getDashboardFn } from "@/lib/inventory";
import { setLowCount } from "@/lib/stock-app-store";
import type { ProductOption } from "@/lib/inventory-types";

export const Route = createFileRoute("/_protected/app/")({
  head: () => ({ meta: [{ title: `Ringkasan stok | ${siteConfig.name}` }] }),
  loader: () => getDashboardFn(),
  component: DashboardPage,
});

const movementLabels: Record<string, string> = {
  in: "Masuk",
  out: "Keluar",
  return_in: "Retur masuk",
  return_out: "Retur keluar",
  adjustment: "Penyesuaian",
};

function signedQuantity(type: string, quantity: number) {
  const sign = type === "out" || type === "return_out" ? "−" : "+";
  return `${sign}${formatQuantity(quantity)}`;
}

function DashboardPage() {
  const dashboard = Route.useLoaderData();

  useEffect(() => {
    setLowCount(dashboard.totals.lowStockCount);
  }, [dashboard.totals.lowStockCount]);

  const router = useRouter();
  const [productOpen, setProductOpen] = useState(false);
  const [productStoreId, setProductStoreId] = useState<string | undefined>();
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<ProductOption | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const { stores, totals, dailyMovements, lowStock, recent } = dashboard;

  function handleSaved(message: string) {
    setNotice(message);
    void router.invalidate();
  }

  function openProductDialog(storeId?: string) {
    setProductStoreId(storeId);
    setProductOpen(true);
  }

  function openMovementDialog(product?: ProductOption) {
    setMovementProduct(product ?? null);
    setMovementOpen(true);
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatLongDate(dashboard.generatedAt)}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ringkasan stok
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            size="lg"
            onClick={() => openProductDialog()}
          >
            <PackagePlus aria-hidden="true" />
            Tambah barang
          </Button>
          <Button size="lg" onClick={() => openMovementDialog()}>
            <ArrowDownToLine aria-hidden="true" />
            Catat barang masuk
          </Button>
        </div>
      </header>

      <div role="status" aria-live="polite">
        {notice && (
          <div className="mt-6 flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3">
            <p className="flex items-start gap-2 text-sm leading-6">
              <CircleCheck
                className="mt-0.5 size-4 shrink-0 text-foreground"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Tutup pemberitahuan"
              onClick={() => setNotice(null)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-10">
        <dl className="grid divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <dt className="text-sm text-muted-foreground">Nilai stok</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatRupiah(totals.stockValue)}
            </dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-sm text-muted-foreground">Jumlah barang</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatQuantity(totals.productCount)}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                barang
              </span>
            </dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-sm text-muted-foreground">Perlu restock</dt>
            <dd
              className={
                totals.lowStockCount > 0
                  ? "mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-warning tabular-nums"
                  : "mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-muted-foreground"
              }
            >
              {totals.productCount === 0 ? (
                <>
                  <Package className="size-5" aria-hidden="true" />
                  <span className="text-lg font-medium">Belum ada barang</span>
                </>
              ) : totals.lowStockCount > 0 ? (
                <>
                  <TriangleAlert className="size-5" aria-hidden="true" />
                  {formatQuantity(totals.lowStockCount)}
                  <span className="text-sm font-normal">barang</span>
                </>
              ) : (
                <>
                  <Check className="size-5" aria-hidden="true" />
                  <span className="text-lg font-medium">Stok aman</span>
                </>
              )}
            </dd>
          </div>
        </dl>

        <StockFlowChart data={dailyMovements} />

        <section aria-labelledby="stores-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2
              id="stores-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Ringkasan lima toko
            </h2>
            <p className="text-sm text-muted-foreground">
              {stores.length} toko aktif
            </p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {stores.map((store) => (
              <li
                key={store.id}
                className="flex min-w-0 flex-col rounded-xl border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm leading-5 font-medium">
                    {store.name}
                  </h3>
                  <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {store.code}
                  </span>
                </div>
                <p className="mt-3 text-base font-semibold tracking-tight break-words tabular-nums sm:text-lg">
                  {formatRupiah(store.stockValue)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatQuantity(store.productCount)} barang
                </p>
                <div className="mt-3 border-t pt-2.5">
                  {store.lowStockCount > 0 ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                      <TriangleAlert
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {formatQuantity(store.lowStockCount)} perlu restock
                    </p>
                  ) : store.productCount === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Belum ada barang
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="size-3.5 shrink-0" aria-hidden="true" />
                      Stok aman
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <ProductSearch />

        <div className="grid gap-10 lg:grid-cols-3 lg:gap-6">
          <section
            aria-labelledby="low-stock-heading"
            className="lg:col-span-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="low-stock-heading"
                className="text-lg font-semibold tracking-tight"
              >
                Perlu restock
              </h2>
              {totals.lowStockCount > 0 && (
                <span className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
                  {formatQuantity(totals.lowStockCount)} barang
                </span>
              )}
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border bg-card">
              {lowStock.length === 0 ? (
                <div className="px-5 py-8">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {totals.productCount === 0 ? (
                      <Package
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    {totals.productCount === 0
                      ? "Belum ada barang tercatat"
                      : "Tidak ada stok menipis"}
                  </p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    {totals.productCount === 0
                      ? "Tambahkan barang pertama untuk mulai memantau stok lima toko."
                      : "Semua barang berada di atas batas minimum."}
                  </p>
                  {totals.productCount === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => openProductDialog()}
                    >
                      <PackagePlus aria-hidden="true" />
                      Tambah barang pertama
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="divide-y">
                  {lowStock.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5"
                    >
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="leading-6 font-medium">{item.name}</p>
                          <StockStatusBadge
                            currentStock={item.currentStock}
                            minStock={item.minStock}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.storeName}
                          {item.sku ? ` · ${item.sku}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        <span className="font-medium text-foreground">
                          {formatQuantity(item.currentStock)}
                        </span>{" "}
                        / min {formatQuantity(item.minStock)} {item.unit}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => openMovementDialog(item)}
                        aria-label={`Tambah stok untuk ${item.name}`}
                      >
                        <Plus aria-hidden="true" />
                        Tambah stok
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {totals.lowStockCount > lowStock.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                Menampilkan {lowStock.length} dari{" "}
                {formatQuantity(totals.lowStockCount)} barang yang menipis.
              </p>
            )}
          </section>

          <section aria-labelledby="recent-heading">
            <h2
              id="recent-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Pergerakan terakhir
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border bg-card">
              {recent.length === 0 ? (
                <p className="px-5 py-8 text-sm leading-6 text-muted-foreground">
                  Belum ada pergerakan stok. Barang masuk yang kamu catat akan
                  muncul di sini.
                </p>
              ) : (
                <ul className="divide-y">
                  {recent.map((movement) => (
                    <li key={movement.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium tabular-nums">
                          {signedQuantity(movement.type, movement.quantity)}{" "}
                          {movement.unit}
                        </p>
                        <span className="rounded border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {movementLabels[movement.type] ?? "Pergerakan"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{movement.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.storeName} ·{" "}
                        {formatDateOnly(movement.movementDate)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      <ProductDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        stores={stores}
        initialStoreId={productStoreId}
        onSaved={handleSaved}
      />
      <MovementDialog
        open={movementOpen}
        onOpenChange={(open) => {
          setMovementOpen(open);
          if (!open) setMovementProduct(null);
        }}
        stores={stores}
        initialProduct={movementProduct}
        onSaved={handleSaved}
        onRequestAddProduct={(storeId) => {
          setMovementOpen(false);
          setMovementProduct(null);
          openProductDialog(storeId);
        }}
      />
    </>
  );
}
