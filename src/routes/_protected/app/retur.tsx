import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Inbox,
  RotateCcw,
} from "lucide-react";
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
  type ProductRecord,
  type ReturnRecord,
  type ReturnType,
  type StoreRecord,
} from "@/lib/inventory-types";
import { setLowCount } from "@/lib/stock-app-store";

export const Route = createFileRoute("/_protected/app/retur")({
  head: () => ({ meta: [{ title: `Retur barang | ${siteConfig.name}` }] }),
  component: ReturnPage,
});

type FormState = {
  storeId: string;
  productId: string;
  quantity: string;
  date: string;
  reason: string;
};

function ReturnPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [returnType, setReturnType] = useState<ReturnType>("to_supplier");
  const [historyStore, setHistoryStore] = useState("");
  const [form, setForm] = useState<FormState>({
    storeId: "",
    productId: "",
    quantity: "",
    date: todayInputValue(),
    reason: "",
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
      getJson<ReturnRecord[]>("/api/returns?limit=100", controller.signal),
    ])
      .then(([storeRows, productRows, returnRows]) => {
        if (controller.signal.aborted) return;
        const active = storeRows.filter((store) => store.isActive);
        setStores(active);
        setProducts(productRows);
        setReturns(returnRows);
        setForm((value) => ({
          ...value,
          storeId: value.storeId || active[0]?.id || "",
        }));
        setLoadError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof Error ? caught.message : "Data retur gagal dimuat.",
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
  const history = returns.filter(
    (item) => !historyStore || item.storeId === historyStore,
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
    const reason = form.reason.trim();

    if (!product) {
      setError("Pilih barang yang diretur.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Jumlah retur harus lebih dari 0.");
      return;
    }
    if (returnType === "to_supplier" && quantity > product.currentStock) {
      setError(
        `Stok tidak cukup. Tersedia ${formatQuantity(product.currentStock)} ${product.unit}.`,
      );
      return;
    }
    if (!form.date) {
      setError("Pilih tanggal retur.");
      return;
    }
    if (!reason) {
      setError("Alasan retur wajib diisi.");
      return;
    }

    setPending(true);
    try {
      const result = await postJson<{
        productName: string;
        unit: string;
        quantity: number;
        currentStock: number;
      }>("/api/returns", {
        productId: product.id,
        type: returnType,
        quantity,
        reason,
        returnDate: form.date,
      });
      showToast(
        returnType === "to_supplier"
          ? `Retur ke pemasok dicatat. Stok ${result.productName} sekarang ${formatQuantity(result.currentStock)} ${result.unit}.`
          : `Retur dari pelanggan dicatat. Stok ${result.productName} sekarang ${formatQuantity(result.currentStock)} ${result.unit}.`,
      );
      setForm((value) => ({ ...value, quantity: "", reason: "" }));
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Retur gagal disimpan.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="retur-page">
      <header className="ss-page-head">
        <div>
          <p className="ss-date">{formatLongDate(new Date().toISOString())}</p>
          <h1 className="ss-title">Retur barang</h1>
          <p className="ss-subtitle">
            Catat barang yang dikembalikan ke pemasok atau diterima kembali dari
            pelanggan.
          </p>
        </div>
      </header>

      <div className="retur-grid">
        <section
          className="ss-card retur-form-card"
          aria-labelledby="retur-form-title"
        >
          <div className="ss-card-head">
            <div>
              <h2 className="ss-card-title" id="retur-form-title">
                Catat retur
              </h2>
              <p className="ss-card-desc">
                {returnType === "to_supplier"
                  ? "Retur ke pemasok mengurangi stok barang."
                  : "Retur dari pelanggan menambah stok barang."}
              </p>
            </div>
          </div>

          <form className="ss-form" onSubmit={handleSubmit} noValidate>
            <div className="retur-type">
              <p className="retur-type-label" id="retur-type-label">
                Jenis retur
              </p>
              <div
                className="ss-seg"
                role="group"
                aria-labelledby="retur-type-label"
              >
                <button
                  type="button"
                  aria-pressed={returnType === "to_supplier"}
                  onClick={() => setReturnType("to_supplier")}
                >
                  Ke pemasok
                </button>
                <button
                  type="button"
                  aria-pressed={returnType === "from_customer"}
                  onClick={() => setReturnType("from_customer")}
                >
                  Dari pelanggan
                </button>
              </div>
            </div>

            <div className="ss-field">
              <label htmlFor="retur-store">Toko</label>
              <select
                id="retur-store"
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
              <label htmlFor="retur-product">Barang</label>
              <select
                id="retur-product"
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
                  ? `${returnType === "to_supplier" ? "Stok tersedia" : "Stok saat ini"} ${formatQuantity(selectedProduct.currentStock)} ${selectedProduct.unit}.`
                  : ""}
              </p>
              <Link to="/app/barang" className="retur-catalog-link">
                Barang belum ada? Tambah di katalog.
              </Link>
            </div>

            <div className="ss-field-row">
              <div className="ss-field">
                <label htmlFor="retur-quantity">
                  Jumlah retur{" "}
                  {selectedProduct && (
                    <span className="ss-optional">
                      ({selectedProduct.unit})
                    </span>
                  )}
                </label>
                <input
                  id="retur-quantity"
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
                <label htmlFor="retur-date">Tanggal</label>
                <input
                  id="retur-date"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, date: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="ss-field">
              <label htmlFor="retur-reason">Alasan retur</label>
              <textarea
                id="retur-reason"
                rows={3}
                maxLength={300}
                placeholder="Contoh: kemasan rusak atau pelanggan membatalkan pesanan"
                value={form.reason}
                onChange={(event) =>
                  setForm((value) => ({ ...value, reason: event.target.value }))
                }
              />
            </div>

            {error && (
              <p className="ss-form-error" role="alert">
                {error}
              </p>
            )}

            <div className="retur-form-actions">
              <button
                type="submit"
                className="ss-btn ss-btn-primary"
                disabled={pending}
              >
                <RotateCcw aria-hidden="true" />
                {pending ? "Menyimpan…" : "Simpan retur"}
              </button>
            </div>
          </form>
        </section>

        <section className="ss-card" aria-labelledby="retur-history-title">
          <div className="ss-card-head">
            <div>
              <h2 className="ss-card-title" id="retur-history-title">
                Riwayat retur
              </h2>
              <p className="ss-card-desc">
                {historyStoreLabel} · {formatQuantity(history.length)} catatan
              </p>
            </div>
            <div className="ss-field retur-history-filter">
              <label htmlFor="retur-filter-store">Toko</label>
              <select
                id="retur-filter-store"
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
              Memuat retur…
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
                Belum ada retur
              </p>
              <p>
                {historyStore
                  ? "Tidak ada retur untuk toko ini."
                  : "Retur yang kamu catat akan muncul di sini."}
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
                      <th scope="col">Jenis</th>
                      <th scope="col">Jumlah</th>
                      <th scope="col">Alasan</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => {
                      const isSupplier = item.type === "to_supplier";
                      return (
                        <tr key={item.id}>
                          <td className="ss-tabular">
                            {formatDateOnly(item.returnDate)}
                          </td>
                          <td>
                            <div>
                              <p className="ss-strong">{item.productName}</p>
                              <p className="ss-meta">
                                {item.sku ?? "Tanpa kode"}
                              </p>
                            </div>
                          </td>
                          <td>{item.storeName}</td>
                          <td>
                            {isSupplier ? (
                              <span className="ss-pill ss-pill-neutral">
                                <ArrowUpFromLine aria-hidden="true" />
                                Ke pemasok
                              </span>
                            ) : (
                              <span className="ss-pill ss-pill-info">
                                <ArrowDownToLine aria-hidden="true" />
                                Dari pelanggan
                              </span>
                            )}
                          </td>
                          <td className="ss-tabular">
                            {isSupplier ? "−" : "+"}
                            {formatQuantity(item.quantity)} {item.unit}
                          </td>
                          <td>{item.reason}</td>
                          <td>
                            <span className="ss-pill ss-pill-success">
                              Tercatat
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
