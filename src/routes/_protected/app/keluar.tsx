import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpFromLine, Inbox } from "lucide-react";
import {
  StockToast,
  type StockToastTone,
} from "@/components/stock-app/stock-toast";
import { siteConfig } from "@/config/site";
import {
  formatDateOnly,
  formatLongDate,
  formatQuantity,
  todayInputValue,
} from "@/lib/format";
import { getJson, postJson } from "@/lib/http-client";
import {
  isLow,
  type MovementRecord,
  type ProductRecord,
  type StoreRecord,
} from "@/lib/inventory-types";
import { setLowCount } from "@/lib/stock-app-store";

export const Route = createFileRoute("/_protected/app/keluar")({
  head: () => ({ meta: [{ title: `Barang keluar | ${siteConfig.name}` }] }),
  component: OutgoingPage,
});

type FormState = {
  storeId: string;
  productId: string;
  quantity: string;
  date: string;
  note: string;
};

function OutgoingPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [historyStore, setHistoryStore] = useState("");
  const [form, setForm] = useState<FormState>({
    storeId: "",
    productId: "",
    quantity: "",
    date: todayInputValue(),
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone?: StockToastTone;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getJson<StoreRecord[]>("/api/stores", controller.signal),
      getJson<ProductRecord[]>("/api/products?limit=200", controller.signal),
      getJson<MovementRecord[]>(
        "/api/stock-movements?type=out&limit=100",
        controller.signal,
      ),
    ])
      .then(([storeRows, productRows, movementRows]) => {
        if (controller.signal.aborted) return;
        const active = storeRows.filter((store) => store.isActive);
        setStores(active);
        setProducts(productRows);
        setMovements(movementRows);
        setForm((value) => ({
          ...value,
          storeId: value.storeId || active[0]?.id || "",
        }));
        setLoadError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof Error
            ? caught.message
            : "Data barang keluar gagal dimuat.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    setLowCount(products.filter(isLow).length);
  }, [products]);

  const storeProducts = products.filter(
    (product) => product.storeId === form.storeId,
  );
  const selectedProduct = products.find(
    (product) => product.id === form.productId,
  );
  const history = movements.filter(
    (movement) => !historyStore || movement.storeId === historyStore,
  );
  const historyStoreLabel = historyStore
    ? (stores.find((store) => store.id === historyStore)?.name ?? "Semua toko")
    : "Semua toko";

  function showToast(message: string, tone: StockToastTone = "success") {
    setToast({ message, tone });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    const product = products.find((item) => item.id === form.productId);
    const quantity = Number(form.quantity);

    if (!product) {
      setError("Pilih barang yang akan dicatat.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Jumlah keluar harus lebih dari 0.");
      return;
    }
    if (quantity > product.currentStock) {
      setError(
        `Stok tidak cukup. Tersedia ${formatQuantity(product.currentStock)} ${product.unit}.`,
      );
      return;
    }
    if (!form.date) {
      setError("Pilih tanggal barang keluar.");
      return;
    }

    setPending(true);
    try {
      const result = await postJson<{
        productName: string;
        unit: string;
        quantity: number;
        currentStock: number;
      }>("/api/stock-movements", {
        type: "out",
        productId: product.id,
        quantity,
        movementDate: form.date,
        note: form.note.trim(),
      });
      showToast(
        `Stok ${result.productName} berkurang ${formatQuantity(result.quantity)} ${result.unit}. Stok sekarang ${formatQuantity(result.currentStock)} ${result.unit}.`,
      );
      setForm((value) => ({ ...value, quantity: "", note: "" }));
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Barang keluar gagal disimpan.",
      );
    } finally {
      setPending(false);
    }
  }

  async function voidMovement(movementId: string) {
    setPending(true);
    try {
      const result = await postJson<{
        productName: string;
        unit: string;
        currentStock: number;
      }>(`/api/stock-movements/${movementId}/void`, {});
      showToast(
        `Catatan ${result.productName} dibatalkan. Stok sekarang ${formatQuantity(result.currentStock)} ${result.unit}.`,
      );
      setReloadKey((key) => key + 1);
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : "Catatan gagal dibatalkan.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="keluar-page">
      <header className="ss-page-head">
        <div>
          <p className="ss-date">{formatLongDate(new Date().toISOString())}</p>
          <h1 className="ss-title">Barang keluar</h1>
          <p className="ss-subtitle">
            Catat penjualan atau pemakaian agar stok berkurang dan riwayat tetap
            terlacak.
          </p>
        </div>
      </header>

      <div className="keluar-grid">
        <section
          className="ss-card keluar-form-card"
          aria-labelledby="keluar-form-title"
        >
          <div className="ss-card-head">
            <div>
              <h2 className="ss-card-title" id="keluar-form-title">
                Catat barang keluar
              </h2>
              <p className="ss-card-desc">Stok berkurang setelah disimpan.</p>
            </div>
          </div>

          <form className="ss-form" onSubmit={handleSubmit} noValidate>
            <div className="ss-field">
              <label htmlFor="keluar-store">Toko</label>
              <select
                id="keluar-store"
                value={form.storeId}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    storeId: event.target.value,
                    productId: "",
                  }))
                }
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ss-field">
              <label htmlFor="keluar-product">Barang</label>
              <select
                id="keluar-product"
                value={form.productId}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    productId: event.target.value,
                  }))
                }
                disabled={storeProducts.length === 0}
              >
                <option value="" disabled>
                  {storeProducts.length === 0
                    ? "Belum ada barang"
                    : "Pilih barang"}
                </option>
                {storeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — stok {formatQuantity(product.currentStock)}{" "}
                    {product.unit}
                  </option>
                ))}
              </select>
              <p className="ss-hint">
                {selectedProduct
                  ? `Stok tersedia ${formatQuantity(selectedProduct.currentStock)} ${selectedProduct.unit}.`
                  : ""}
              </p>
              <Link to="/app/barang" className="keluar-catalog-link">
                Barang belum ada? Tambah di katalog.
              </Link>
            </div>

            <div className="ss-field-row">
              <div className="ss-field">
                <label htmlFor="keluar-quantity">
                  Jumlah keluar{" "}
                  {selectedProduct && (
                    <span className="ss-optional">
                      ({selectedProduct.unit})
                    </span>
                  )}
                </label>
                <input
                  id="keluar-quantity"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      quantity: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="ss-field">
                <label htmlFor="keluar-date">Tanggal</label>
                <input
                  id="keluar-date"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, date: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="ss-field">
              <label htmlFor="keluar-note">
                Keterangan <span className="ss-optional">(opsional)</span>
              </label>
              <input
                id="keluar-note"
                maxLength={500}
                placeholder="Nomor nota, penjualan, atau pemakaian"
                value={form.note}
                onChange={(event) =>
                  setForm((value) => ({ ...value, note: event.target.value }))
                }
              />
            </div>

            {error && (
              <p className="ss-form-error" role="alert">
                {error}
              </p>
            )}

            <div className="keluar-form-actions">
              <button
                type="submit"
                className="ss-btn ss-btn-primary"
                disabled={pending}
              >
                <ArrowUpFromLine aria-hidden="true" />
                {pending ? "Menyimpan…" : "Simpan barang keluar"}
              </button>
            </div>
          </form>
        </section>

        <section className="ss-card" aria-labelledby="keluar-history-title">
          <div className="ss-card-head">
            <div>
              <h2 className="ss-card-title" id="keluar-history-title">
                Riwayat barang keluar
              </h2>
              <p className="ss-card-desc">
                {historyStoreLabel} · {formatQuantity(history.length)} catatan
              </p>
            </div>
            <div className="ss-field keluar-history-filter">
              <label htmlFor="keluar-filter-store">Toko</label>
              <select
                id="keluar-filter-store"
                value={historyStore}
                onChange={(event) => setHistoryStore(event.target.value)}
              >
                <option value="">Semua toko</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p role="status" className="ss-empty">
              Memuat catatan…
            </p>
          ) : loadError ? (
            <div className="ss-empty">
              <p className="ss-empty-title" role="alert">
                {loadError}
              </p>
              <button
                type="button"
                className="ss-btn ss-btn-outline ss-btn-sm"
                onClick={() => {
                  setLoading(true);
                  setReloadKey((key) => key + 1);
                }}
              >
                Coba lagi
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="ss-empty">
              <p className="ss-empty-title">
                <Inbox aria-hidden="true" />
                Belum ada catatan
              </p>
              <p>
                {historyStore
                  ? "Tidak ada barang keluar untuk toko ini."
                  : "Barang keluar yang kamu catat akan muncul di sini."}
              </p>
              {historyStore && (
                <button
                  type="button"
                  className="ss-btn ss-btn-outline ss-btn-sm"
                  onClick={() => setHistoryStore("")}
                >
                  Tampilkan semua toko
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="ss-table-wrap">
                <table className="ss-table">
                  <thead>
                    <tr>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Barang</th>
                      <th scope="col">Toko</th>
                      <th scope="col">Jumlah</th>
                      <th scope="col">Keterangan</th>
                      <th scope="col">Status</th>
                      <th scope="col">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((movement) => (
                      <tr key={movement.id}>
                        <td className="ss-tabular">
                          {formatDateOnly(movement.movementDate)}
                        </td>
                        <td>
                          <div>
                            <p className="ss-strong">{movement.productName}</p>
                            <p className="ss-meta">
                              {movement.sku ?? "Tanpa kode"}
                            </p>
                          </div>
                        </td>
                        <td>{movement.storeName}</td>
                        <td className="ss-tabular">
                          <span
                            className={movement.isVoid ? "keluar-void" : ""}
                          >
                            −{formatQuantity(movement.quantity)} {movement.unit}
                          </span>
                        </td>
                        <td>
                          {movement.note || <span className="ss-meta">—</span>}
                        </td>
                        <td>
                          {movement.isVoid ? (
                            <span className="ss-pill ss-pill-neutral">
                              Dibatalkan
                            </span>
                          ) : (
                            <span className="ss-pill ss-pill-success">
                              Tercatat
                            </span>
                          )}
                        </td>
                        <td>
                          {movement.isVoid ? (
                            <span className="ss-meta">—</span>
                          ) : (
                            <button
                              type="button"
                              className="ss-btn ss-btn-ghost ss-btn-sm"
                              onClick={() => voidMovement(movement.id)}
                              disabled={pending}
                              aria-label={`Batalkan barang keluar ${movement.productName} tanggal ${formatDateOnly(movement.movementDate)}`}
                            >
                              Batalkan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ss-table-hint">
                Geser tabel ke samping untuk melihat semua kolom.
              </p>
            </>
          )}
        </section>
      </div>

      <StockToast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
