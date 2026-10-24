import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PackagePlus, PackageSearch, Pencil, X } from "lucide-react";
import { StockDialog } from "@/components/stock-app/stock-dialog";
import { StockPill } from "@/components/stock-app/stock-pill";
import {
  StockToast,
  type StockToastTone,
} from "@/components/stock-app/stock-toast";
import { siteConfig } from "@/config/site";
import { formatLongDate, formatQuantity, formatRupiah } from "@/lib/format";
import { getJson, patchJson, postJson } from "@/lib/http-client";
import {
  isLow,
  isOut,
  productUnitOptions,
  type ProductRecord,
  type StoreRecord,
} from "@/lib/inventory-types";
import { setLowCount } from "@/lib/stock-app-store";

export const Route = createFileRoute("/_protected/app/barang")({
  head: () => ({ meta: [{ title: `Katalog barang | ${siteConfig.name}` }] }),
  component: CatalogPage,
});

type FormState = {
  storeId: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  min: string;
};

function blankForm(storeId = ""): FormState {
  return {
    storeId,
    name: "",
    sku: "",
    category: "",
    unit: "pcs",
    purchasePrice: "",
    sellingPrice: "",
    min: "",
  };
}

function CatalogPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "low" | "out">("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone?: StockToastTone;
  } | null>(null);

  const activeStores = useMemo(
    () => stores.filter((store) => store.isActive),
    [stores],
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getJson<StoreRecord[]>("/api/stores", controller.signal),
      getJson<ProductRecord[]>("/api/products?limit=200", controller.signal),
    ])
      .then(([storeRows, productRows]) => {
        if (controller.signal.aborted) return;
        setStores(storeRows);
        setProducts(productRows);
        setLoadError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof Error
            ? caught.message
            : "Daftar barang gagal dimuat.",
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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products
      .filter((product) => {
        if (storeFilter && product.storeId !== storeFilter) return false;
        if (statusFilter === "low" && !(isLow(product) && !isOut(product)))
          return false;
        if (statusFilter === "out" && !isOut(product)) return false;
        if (!needle) return true;
        return (
          product.name.toLowerCase().includes(needle) ||
          (product.sku ?? "").toLowerCase().includes(needle)
        );
      })
      .sort(
        (a, b) =>
          a.storeName.localeCompare(b.storeName, "id") ||
          a.name.localeCompare(b.name, "id"),
      );
  }, [products, search, statusFilter, storeFilter]);

  const storeLabel = storeFilter
    ? (stores.find((store) => store.id === storeFilter)?.name ?? "Semua toko")
    : "Semua toko";
  const statusLabel =
    statusFilter === "low"
      ? "Menipis"
      : statusFilter === "out"
        ? "Habis"
        : "Semua status";
  const searchLabel = search.trim() ? ` · cari “${search.trim()}”` : "";

  function showToast(message: string, tone: StockToastTone = "success") {
    setToast({ message, tone });
  }

  function openAdd() {
    setEditingId(null);
    setForm(blankForm(activeStores[0]?.id ?? ""));
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setEditingId(id);
    setForm({
      storeId: product.storeId,
      name: product.name,
      sku: product.sku ?? "",
      category: product.category ?? "",
      unit: product.unit,
      purchasePrice: String(product.purchasePrice),
      sellingPrice: String(product.sellingPrice),
      min: String(product.minStock),
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);

    const name = form.name.trim();
    const sku = form.sku.trim();
    const category = form.category.trim();
    const unit = form.unit.trim() || "pcs";
    const purchasePrice = Number(form.purchasePrice || 0);
    const sellingPrice = Number(form.sellingPrice || 0);
    const min = Number(form.min || 0);

    if (!form.storeId) {
      setError("Pilih toko untuk barang ini.");
      return;
    }
    if (!name) {
      setError("Nama barang wajib diisi.");
      return;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setError("Harga beli tidak boleh negatif.");
      return;
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setError("Harga jual tidak boleh negatif.");
      return;
    }
    if (!Number.isFinite(min) || min < 0) {
      setError("Batas stok minimum tidak boleh negatif.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await patchJson(`/api/products/${editingId}`, {
          storeId: form.storeId,
          name,
          sku,
          category,
          unit,
          purchasePrice,
          sellingPrice,
          minStock: min,
        });
        showToast(`Barang “${name}” diperbarui.`);
      } else {
        await postJson("/api/products", {
          storeId: form.storeId,
          name,
          sku,
          category,
          unit,
          purchasePrice,
          sellingPrice,
          minStock: min,
        });
        showToast(`Barang “${name}” ditambahkan. Stok awal 0.`);
      }
      setDialogOpen(false);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Barang gagal disimpan. Coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="catalog-page">
      <header className="ss-page-head">
        <div>
          <p className="ss-date">{formatLongDate(new Date().toISOString())}</p>
          <h1 className="ss-title">Katalog barang</h1>
          <p className="ss-subtitle">
            Kelola barang tiap toko, lengkap dengan harga beli, harga jual, dan
            batas stok minimum.
          </p>
        </div>
        <div className="ss-actions">
          <button
            type="button"
            className="ss-btn ss-btn-primary"
            onClick={openAdd}
            disabled={activeStores.length === 0}
          >
            <PackagePlus aria-hidden="true" />
            Tambah barang
          </button>
        </div>
      </header>

      <section className="ss-card" aria-labelledby="catalog-filter-title">
        <div className="ss-card-head">
          <h2 className="ss-card-title" id="catalog-filter-title">
            Filter barang
          </h2>
        </div>
        <div className="catalog-filters">
          <div className="ss-field">
            <label htmlFor="catalog-store">Toko</label>
            <select
              id="catalog-store"
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
            >
              <option value="">Semua toko</option>
              {activeStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ss-field">
            <label htmlFor="catalog-search">Cari barang</label>
            <input
              id="catalog-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama atau kode barang"
              autoComplete="off"
            />
          </div>
          <div className="catalog-status">
            <div className="catalog-status-head">
              <p className="catalog-label" id="catalog-status-label">
                Status stok
              </p>
              <button
                type="button"
                className="ss-btn ss-btn-ghost ss-btn-xs"
                onClick={() => {
                  setStoreFilter("");
                  setStatusFilter("");
                  setSearch("");
                }}
              >
                Reset
              </button>
            </div>
            <div
              className="ss-seg"
              role="group"
              aria-labelledby="catalog-status-label"
            >
              {(
                [
                  ["", "Semua"],
                  ["low", "Menipis"],
                  ["out", "Habis"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value || "all"}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-card" aria-labelledby="catalog-list-title">
        <div className="ss-card-head">
          <div>
            <h2 className="ss-card-title" id="catalog-list-title">
              Daftar barang
            </h2>
            <p className="ss-card-desc">
              {storeLabel} · {statusLabel}
              {searchLabel}
            </p>
          </div>
          <p className="ss-meta">{formatQuantity(filtered.length)} barang</p>
        </div>

        {loading ? (
          <p role="status" className="ss-empty">
            Memuat barang…
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
        ) : filtered.length === 0 ? (
          <div className="ss-empty">
            <p className="ss-empty-title">
              <PackageSearch aria-hidden="true" />
              Tidak ada barang yang cocok
            </p>
            <p>
              {products.length === 0
                ? "Tambah barang pertama untuk toko ini."
                : "Ubah toko, status, atau kata kunci pencarian."}
            </p>
            <button
              type="button"
              className="ss-btn ss-btn-outline ss-btn-sm"
              onClick={() => {
                setStoreFilter("");
                setStatusFilter("");
                setSearch("");
              }}
            >
              Reset filter
            </button>
          </div>
        ) : (
          <>
            <div className="ss-table-wrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th scope="col">Barang</th>
                    <th scope="col">Toko</th>
                    <th scope="col">Kategori / satuan</th>
                    <th scope="col">Harga beli</th>
                    <th scope="col">Harga jual</th>
                    <th scope="col">Stok</th>
                    <th scope="col">Status</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="catalog-name">
                          <p className="ss-strong">{product.name}</p>
                          <p className="ss-meta">
                            {product.sku ?? "Tanpa kode"}
                          </p>
                        </div>
                      </td>
                      <td>{product.storeName}</td>
                      <td>
                        {product.category ?? "—"}
                        <span className="ss-muted"> / {product.unit}</span>
                      </td>
                      <td className="ss-tabular">
                        {formatRupiah(product.purchasePrice)}
                      </td>
                      <td className="ss-tabular">
                        {formatRupiah(product.sellingPrice)}
                      </td>
                      <td className="ss-tabular catalog-stock">
                        <span className="ss-strong">
                          {formatQuantity(product.currentStock)}
                        </span>{" "}
                        {product.unit}
                        <span className="ss-meta">
                          {" "}
                          · min {formatQuantity(product.minStock)}
                        </span>
                      </td>
                      <td>
                        <StockPill
                          currentStock={product.currentStock}
                          minStock={product.minStock}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ss-btn ss-btn-ghost ss-btn-sm"
                          onClick={() => openEdit(product.id)}
                          aria-label={`Ubah ${product.name}`}
                        >
                          <Pencil aria-hidden="true" />
                          Ubah
                        </button>
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

      <StockDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        labelledBy="catalog-dialog-title"
        describedBy="catalog-dialog-desc"
      >
        <div className="ss-dialog-inner">
          <div className="ss-dialog-head">
            <div>
              <h2 className="ss-dialog-title" id="catalog-dialog-title">
                {editingId ? "Ubah barang" : "Tambah barang"}
              </h2>
              <p className="ss-dialog-desc" id="catalog-dialog-desc">
                {editingId
                  ? "Perbarui data barang. Jumlah stok tidak berubah dari dialog ini."
                  : "Stok awal 0. Catat barang masuk setelah barang disimpan."}
              </p>
            </div>
            <button
              type="button"
              className="ss-dialog-close"
              onClick={() => setDialogOpen(false)}
              aria-label="Tutup dialog barang"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <form className="ss-form" onSubmit={handleSubmit} noValidate>
            <div className="ss-field">
              <label htmlFor="catalog-form-store">Toko</label>
              <select
                id="catalog-form-store"
                value={form.storeId}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    storeId: event.target.value,
                  }))
                }
              >
                {activeStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ss-field">
              <label htmlFor="catalog-form-name">Nama barang</label>
              <input
                id="catalog-form-name"
                value={form.name}
                onChange={(event) =>
                  setForm((value) => ({ ...value, name: event.target.value }))
                }
                maxLength={160}
                placeholder="Contoh: Pupuk Urea 50 kg"
                aria-describedby={error ? "catalog-form-error" : undefined}
                data-autofocus
              />
            </div>
            <div className="ss-field-row">
              <div className="ss-field">
                <label htmlFor="catalog-form-sku">
                  Kode barang <span className="ss-optional">(opsional)</span>
                </label>
                <input
                  id="catalog-form-sku"
                  value={form.sku}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, sku: event.target.value }))
                  }
                  maxLength={60}
                  placeholder="PPK-001"
                  autoComplete="off"
                />
              </div>
              <div className="ss-field">
                <label htmlFor="catalog-form-category">
                  Kategori <span className="ss-optional">(opsional)</span>
                </label>
                <input
                  id="catalog-form-category"
                  value={form.category}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      category: event.target.value,
                    }))
                  }
                  maxLength={80}
                  placeholder="Pupuk"
                />
              </div>
            </div>
            <div className="ss-field-row">
              <div className="ss-field">
                <label htmlFor="catalog-form-unit">Satuan</label>
                <select
                  id="catalog-form-unit"
                  value={form.unit}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, unit: event.target.value }))
                  }
                  required
                >
                  {Array.from(new Set([form.unit, ...productUnitOptions])).map(
                    (unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="ss-field">
                <label htmlFor="catalog-form-purchase-price">
                  Harga beli
                </label>
                <input
                  id="catalog-form-purchase-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      purchasePrice: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="ss-field-row">
              <div className="ss-field">
                <label htmlFor="catalog-form-selling-price">Harga jual</label>
                <input
                  id="catalog-form-selling-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      sellingPrice: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="ss-field">
                <label htmlFor="catalog-form-min">Batas stok minimum</label>
                <input
                  id="catalog-form-min"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.min}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, min: event.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <p className="ss-note">
              Barang baru mulai dengan stok 0. Gunakan Barang masuk untuk
              menambah stok.
            </p>
            {error && (
              <p className="ss-form-error" id="catalog-form-error" role="alert">
                {error}
              </p>
            )}
            <div className="ss-dialog-actions">
              <button
                type="button"
                className="ss-btn ss-btn-outline"
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="ss-btn ss-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Menyimpan…"
                  : editingId
                    ? "Simpan perubahan"
                    : "Simpan barang"}
              </button>
            </div>
          </form>
        </div>
      </StockDialog>

      <StockToast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
