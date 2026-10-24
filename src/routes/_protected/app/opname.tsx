import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCheck,
  ClipboardCheck,
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
  type OpnameRecord,
  type ProductRecord,
  type StoreRecord,
} from "@/lib/inventory-types";
import { setLowCount } from "@/lib/stock-app-store";

export const Route = createFileRoute("/_protected/app/opname")({
  head: () => ({ meta: [{ title: `Stock opname | ${siteConfig.name}` }] }),
  component: OpnamePage,
});

type Counts = Record<string, number | null>;

function DiffPill({
  product,
  count,
}: {
  product: ProductRecord;
  count: number | null | undefined;
}) {
  if (count === null || count === undefined || !Number.isFinite(count))
    return <span className="ss-meta">—</span>;

  const diff = Math.round((count - product.currentStock) * 100) / 100;
  if (diff === 0)
    return (
      <span className="ss-pill ss-pill-success">
        <Check aria-hidden="true" />
        Sesuai
      </span>
    );
  if (diff < 0)
    return (
      <span className="ss-pill ss-pill-warning">
        <ArrowDown aria-hidden="true" />
        Kurang {formatQuantity(Math.abs(diff))}
      </span>
    );
  return (
    <span className="ss-pill ss-pill-info">
      <ArrowUp aria-hidden="true" />
      Lebih {formatQuantity(diff)}
    </span>
  );
}

function OpnamePage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [sessions, setSessions] = useState<OpnameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedStore, setSelectedStore] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [countsState, setCountsState] = useState<{
    key: string;
    values: Counts;
  }>({ key: "", values: {} });
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
      getJson<OpnameRecord[]>("/api/opnames?limit=50", controller.signal),
    ])
      .then(([storeRows, productRows, sessionRows]) => {
        if (controller.signal.aborted) return;
        const active = storeRows.filter((store) => store.isActive);
        setStores(active);
        setProducts(productRows);
        setSessions(sessionRows);
        setSelectedStore((value) => value || active[0]?.id || "");
        setLoadError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof Error
            ? caught.message
            : "Data opname gagal dimuat.",
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

  const storeItems = useMemo(
    () => products.filter((product) => product.storeId === selectedStore),
    [products, selectedStore],
  );

  const signature = `${selectedStore}:${storeItems
    .map((product) => `${product.id}=${product.currentStock}`)
    .join(",")}`;

  const defaultCounts = useMemo(() => {
    const next: Counts = {};
    for (const product of storeItems) next[product.id] = product.currentStock;
    return next;
  }, [storeItems]);

  // Counts follow the loaded stock until the user edits or resets them.
  const counts =
    countsState.key === signature ? countsState.values : defaultCounts;

  const invalid = storeItems.some((product) => {
    const value = counts[product.id];
    return (
      value === null ||
      value === undefined ||
      !Number.isFinite(value) ||
      value < 0
    );
  });

  const differences = storeItems.filter((product) => {
    const value = counts[product.id];
    return (
      value !== null &&
      value !== undefined &&
      Number.isFinite(value) &&
      Math.round((value - product.currentStock) * 100) / 100 !== 0
    );
  });

  const summary =
    storeItems.length === 0
      ? "Belum ada barang di toko ini."
      : invalid
        ? "Lengkapi semua hitungan fisik terlebih dahulu."
        : differences.length === 0
          ? "Tidak ada selisih. Stok sistem sudah sesuai dengan hitungan fisik."
          : `${formatQuantity(differences.length)} barang memiliki selisih. Periksa lalu simpan penyesuaian.`;

  function showToast(message: string, tone: StockToastTone = "success") {
    setToast({ message, tone });
  }

  function resetCounts() {
    setCountsState({ key: signature, values: defaultCounts });
    showToast("Hitungan fisik direset ke stok sistem.");
  }

  async function saveOpname() {
    if (pending || invalid || differences.length === 0 || !selectedStore)
      return;
    setPending(true);
    try {
      const result = await postJson<{
        adjustmentCount: number;
      }>("/api/opnames", {
        storeId: selectedStore,
        opnameDate: date,
        note: "",
        items: storeItems.map((product) => ({
          productId: product.id,
          physicalQty: counts[product.id],
        })),
      });
      showToast(
        `Penyesuaian disimpan. ${formatQuantity(result.adjustmentCount)} barang diperbarui.`,
      );
      setReloadKey((key) => key + 1);
    } catch (caught) {
      showToast(
        caught instanceof Error
          ? caught.message
          : "Penyesuaian gagal disimpan.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="opname-page">
      <header className="ss-page-head">
        <div>
          <p className="ss-date">{formatLongDate(new Date().toISOString())}</p>
          <h1 className="ss-title">Stock opname</h1>
          <p className="ss-subtitle">
            Cocokkan stok catatan dengan hasil hitung fisik di gudang, lalu
            sesuaikan selisihnya.
          </p>
        </div>
      </header>

      <section className="ss-card" aria-labelledby="opname-session-title">
        <div className="ss-card-head">
          <div>
            <h2 className="ss-card-title" id="opname-session-title">
              Hitung stok fisik
            </h2>
            <p className="ss-card-desc">
              Masukkan hasil hitung fisik per barang untuk toko yang dipilih.
            </p>
          </div>
          <button
            type="button"
            className="ss-btn ss-btn-primary opname-save"
            onClick={saveOpname}
            disabled={pending || invalid || differences.length === 0}
          >
            <CheckCheck aria-hidden="true" />
            {pending ? "Menyimpan…" : "Simpan penyesuaian"}
          </button>
        </div>

        <div className="opname-toolbar">
          <div className="ss-field">
            <label htmlFor="opname-store">Toko</label>
            <select
              id="opname-store"
              value={selectedStore}
              onChange={(event) => setSelectedStore(event.target.value)}
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ss-field">
            <label htmlFor="opname-date">Tanggal opname</label>
            <input
              id="opname-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="opname-tools">
            <button
              type="button"
              className="ss-btn ss-btn-outline ss-btn-sm"
              onClick={resetCounts}
            >
              <RotateCcw aria-hidden="true" />
              Reset hitungan
            </button>
          </div>
        </div>

        <p className="opname-summary">{summary}</p>

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
        ) : storeItems.length === 0 ? (
          <div className="ss-empty">
            <p className="ss-empty-title">
              <ClipboardCheck aria-hidden="true" />
              Belum ada barang
            </p>
            <p>Tambah barang di katalog sebelum melakukan opname.</p>
          </div>
        ) : (
          <>
            <div className="ss-table-wrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th scope="col">Barang</th>
                    <th scope="col">Stok sistem</th>
                    <th scope="col">Hitung fisik</th>
                    <th scope="col">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {storeItems.map((product) => {
                    const count = counts[product.id];
                    return (
                      <tr key={product.id}>
                        <td>
                          <div>
                            <p className="ss-strong">{product.name}</p>
                            <p className="ss-meta">
                              {product.sku ?? "Tanpa kode"}
                            </p>
                          </div>
                        </td>
                        <td className="ss-tabular">
                          {formatQuantity(product.currentStock)} {product.unit}
                        </td>
                        <td>
                          <input
                            className="opname-input"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={count ?? ""}
                            onChange={(event) => {
                              const raw = event.target.value;
                              const value = raw === "" ? null : Number(raw);
                              setCountsState({
                                key: signature,
                                values: { ...counts, [product.id]: value },
                              });
                            }}
                            aria-label={`Hitung fisik ${product.name}`}
                          />
                          <span className="opname-unit">{product.unit}</span>
                        </td>
                        <td>
                          <DiffPill product={product} count={count} />
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

      <section
        className="ss-card opname-history"
        aria-labelledby="opname-history-title"
      >
        <div className="ss-card-head">
          <div>
            <h2 className="ss-card-title" id="opname-history-title">
              Riwayat opname
            </h2>
            <p className="ss-card-desc">
              Semua toko · {formatQuantity(sessions.length)} sesi
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="ss-empty">
            <p className="ss-empty-title">
              <ClipboardCheck aria-hidden="true" />
              Belum ada sesi opname
            </p>
            <p>Sesi yang disimpan akan muncul di sini.</p>
          </div>
        ) : (
          <>
            <div className="ss-table-wrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th scope="col">Tanggal</th>
                    <th scope="col">Toko</th>
                    <th scope="col">Barang dihitung</th>
                    <th scope="col">Penyesuaian</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td className="ss-tabular">
                        {formatDateOnly(session.opnameDate)}
                      </td>
                      <td>{session.storeName}</td>
                      <td className="ss-tabular">
                        {formatQuantity(session.itemCount)} barang
                      </td>
                      <td>
                        <p className="ss-strong">
                          {formatQuantity(session.adjustmentCount)} barang
                        </p>
                        <p className="ss-meta">{session.summary}</p>
                      </td>
                      <td>
                        <span className="ss-pill ss-pill-success">
                          {session.status === "selesai" ? "Selesai" : "Draft"}
                        </span>
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

      <StockToast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
