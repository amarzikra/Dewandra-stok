import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ClipboardCheck,
  FileSearch,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  TriangleAlert,
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
  formatRupiah,
  todayInputValue,
} from "@/lib/format";
import { getJson } from "@/lib/http-client";
import {
  type MovementType,
  type Report,
  type StoreRecord,
} from "@/lib/inventory-types";
import { setLowCount } from "@/lib/stock-app-store";

export const Route = createFileRoute("/_protected/app/laporan")({
  head: () => ({ meta: [{ title: `Laporan | ${siteConfig.name}` }] }),
  component: ReportPage,
});

type ReportType = "stock" | "mutation";

function typeBadge(type: MovementType) {
  if (type === "in")
    return (
      <span className="ss-pill ss-pill-success">
        <ArrowDownToLine aria-hidden="true" />
        Masuk
      </span>
    );
  if (type === "out")
    return (
      <span className="ss-pill ss-pill-neutral">
        <ArrowUpFromLine aria-hidden="true" />
        Keluar
      </span>
    );
  if (type === "return_in")
    return (
      <span className="ss-pill ss-pill-info">
        <RotateCcw aria-hidden="true" />
        Retur masuk
      </span>
    );
  if (type === "return_out")
    return (
      <span className="ss-pill ss-pill-neutral">
        <RotateCcw aria-hidden="true" />
        Retur keluar
      </span>
    );
  return (
    <span className="ss-pill ss-pill-info">
      <ClipboardCheck aria-hidden="true" />
      Penyesuaian
    </span>
  );
}

function signedQty(type: MovementType, qty: number, unit: string) {
  const negative = type === "out" || type === "return_out" || qty < 0;
  return `${negative ? "−" : "+"}${formatQuantity(Math.abs(qty))} ${unit}`;
}

function monthStart() {
  const value = todayInputValue();
  return `${value.slice(0, 8)}01`;
}

function ReportPage() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [reportType, setReportType] = useState<ReportType>("stock");
  const [storeFilter, setStoreFilter] = useState("");
  const [reportDate, setReportDate] = useState(todayInputValue);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(todayInputValue);
  const [report, setReport] = useState<Report | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    tone?: StockToastTone;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<StoreRecord[]>("/api/stores", controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setStores(rows.filter((store) => store.isActive));
      })
      .catch(() => {
        // The report below surfaces the connection error if it also fails.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ type: reportType });
    if (storeFilter) query.set("storeId", storeFilter);
    if (reportType === "stock") {
      if (reportDate) {
        query.set("from", reportDate);
        query.set("to", reportDate);
      }
    } else {
      if (fromDate) query.set("from", fromDate);
      if (toDate) query.set("to", toDate);
    }
    const key = `${query.toString()}:${reloadKey}`;
    getJson<Report>(`/api/reports?${query.toString()}`, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setReport(result);
        setLoadError(null);
        setLoadedKey(key);
        if (result.type === "stock") setLowCount(result.totals.lowStockCount);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof Error ? caught.message : "Laporan gagal dimuat.",
        );
        setLoadedKey(key);
      });
    return () => controller.abort();
  }, [reportType, storeFilter, reportDate, fromDate, toDate, reloadKey]);

  const queryKey = (() => {
    const query = new URLSearchParams({ type: reportType });
    if (storeFilter) query.set("storeId", storeFilter);
    if (reportType === "stock") {
      if (reportDate) {
        query.set("from", reportDate);
        query.set("to", reportDate);
      }
    } else {
      if (fromDate) query.set("from", fromDate);
      if (toDate) query.set("to", toDate);
    }
    return `${query.toString()}:${reloadKey}`;
  })();
  const loading = loadedKey !== queryKey;

  const stockStores = report?.type === "stock" ? report.stores : [];
  const totals =
    report?.type === "stock"
      ? report.totals
      : { itemCount: 0, stockValue: 0, lowStockCount: 0, sold: 0 };
  const mutations = report?.type === "mutation" ? report.movements : [];

  const storeLabel = storeFilter
    ? (stores.find((store) => store.id === storeFilter)?.name ?? "Semua toko")
    : "Semua toko";
  const period =
    reportType === "stock"
      ? formatDateOnly(report?.type === "stock" ? report.period.to : reportDate)
      : `${formatDateOnly(fromDate || monthStart())} – ${formatDateOnly(toDate || todayInputValue())}`;

  function resetFilters() {
    setReportType("stock");
    setStoreFilter("");
    setReportDate(todayInputValue());
    setFromDate(monthStart());
    setToDate(todayInputValue());
  }

  function exportCsv() {
    const query = new URLSearchParams({ type: reportType });
    if (storeFilter) query.set("storeId", storeFilter);
    if (reportType === "stock") {
      if (reportDate) {
        query.set("from", reportDate);
        query.set("to", reportDate);
      }
    } else {
      if (fromDate) query.set("from", fromDate);
      if (toDate) query.set("to", toDate);
    }
    const link = document.createElement("a");
    link.href = `/api/reports/export?${query.toString()}`;
    link.download =
      reportType === "stock" ? "laporan-stok.csv" : "laporan-mutasi.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setToast({ message: "File Excel (CSV) disiapkan untuk diunduh." });
  }

  return (
    <div className="report-page">
      <header className="ss-page-head">
        <div>
          <p className="ss-date">{formatLongDate(new Date().toISOString())}</p>
          <h1 className="ss-title">Laporan</h1>
          <p className="ss-subtitle">
            Lihat posisi stok dan mutasi barang, lalu ekspor untuk dibagikan
            atau diarsipkan.
          </p>
        </div>
        <div className="ss-actions">
          <button
            type="button"
            className="ss-btn ss-btn-outline"
            onClick={exportCsv}
          >
            <FileSpreadsheet aria-hidden="true" />
            Ekspor Excel
          </button>
          <button
            type="button"
            className="ss-btn ss-btn-primary"
            onClick={() => {
              setToast({
                message: "Dialog cetak dibuka. Pilih Simpan sebagai PDF.",
              });
              window.print();
            }}
          >
            <Printer aria-hidden="true" />
            Ekspor PDF
          </button>
        </div>
      </header>

      <section
        className="ss-card report-filter-card"
        aria-labelledby="report-filter-title"
      >
        <div className="ss-card-head">
          <h2 className="ss-card-title" id="report-filter-title">
            Filter laporan
          </h2>
        </div>
        <div className="report-filters">
          <div className="report-type">
            <p className="report-label" id="report-type-label">
              Jenis laporan
            </p>
            <div
              className="ss-seg"
              role="group"
              aria-labelledby="report-type-label"
            >
              <button
                type="button"
                aria-pressed={reportType === "stock"}
                onClick={() => setReportType("stock")}
              >
                Stok per toko
              </button>
              <button
                type="button"
                aria-pressed={reportType === "mutation"}
                onClick={() => setReportType("mutation")}
              >
                Mutasi barang
              </button>
            </div>
          </div>
          <div className="ss-field">
            <label htmlFor="report-store">Toko</label>
            <select
              id="report-store"
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
            >
              <option value="">Semua toko</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          {reportType === "stock" ? (
            <div className="report-dates">
              <div className="ss-field">
                <label htmlFor="report-date">Tanggal laporan</label>
                <input
                  id="report-date"
                  type="date"
                  value={reportDate}
                  onChange={(event) => setReportDate(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="report-dates">
              <div className="ss-field">
                <label htmlFor="report-from">Dari tanggal</label>
                <input
                  id="report-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div className="ss-field">
                <label htmlFor="report-to">Sampai tanggal</label>
                <input
                  id="report-to"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
            </div>
          )}
          <button
            type="button"
            className="ss-btn ss-btn-ghost ss-btn-sm report-reset"
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="ss-card" aria-labelledby="report-preview-title">
        <div className="ss-card-head">
          <div>
            <h2 className="ss-card-title" id="report-preview-title">
              {reportType === "stock"
                ? "Penjualan & stok per toko"
                : "Mutasi barang"}
            </h2>
            <p className="ss-card-desc">
              {storeLabel} · {period}
            </p>
          </div>
          <p className="ss-meta">
            {reportType === "stock"
              ? `${formatQuantity(stockStores.length)} toko`
              : `${formatQuantity(mutations.length)} mutasi`}
          </p>
        </div>

        {loading ? (
          <p role="status" className="ss-empty">
            Memuat laporan…
          </p>
        ) : loadError ? (
          <div className="ss-empty">
            <p className="ss-empty-title" role="alert">
              {loadError}
            </p>
            <button
              type="button"
              className="ss-btn ss-btn-outline ss-btn-sm"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Coba lagi
            </button>
          </div>
        ) : reportType === "stock" ? (
          <>
            <dl className="report-summary">
              <div>
                <dt>Jumlah barang</dt>
                <dd>{formatQuantity(totals.itemCount)}</dd>
              </div>
              <div>
                <dt>Nilai stok</dt>
                <dd>{formatRupiah(totals.stockValue)}</dd>
              </div>
              <div>
                <dt>Perlu restock</dt>
                <dd>{formatQuantity(totals.lowStockCount)}</dd>
              </div>
            </dl>

            <div className="report-store-list">
              {stockStores.map((store) => (
                <section
                  key={store.id}
                  className="report-store-block"
                  aria-labelledby={`report-store-${store.id}`}
                >
                  <div className="report-store-head">
                    <div>
                      <h3
                        className="report-store-title"
                        id={`report-store-${store.id}`}
                      >
                        {store.name}
                        <span className="ss-code">{store.code}</span>
                      </h3>
                      <p className="report-store-meta">
                        {period} · {formatQuantity(store.itemCount)} barang ·{" "}
                        {formatRupiah(store.stockValue)} ·{" "}
                        {formatQuantity(
                          store.items.reduce(
                            (total, item) => total + item.sold,
                            0,
                          ),
                        )}{" "}
                        terjual
                      </p>
                    </div>
                    {store.lowStockCount > 0 ? (
                      <span className="ss-pill ss-pill-warning">
                        <TriangleAlert aria-hidden="true" />
                        {formatQuantity(store.lowStockCount)} perlu restock
                      </span>
                    ) : (
                      <span className="ss-pill ss-pill-success">
                        <Check aria-hidden="true" />
                        Stok aman
                      </span>
                    )}
                  </div>

                  {store.items.length === 0 ? (
                    <p className="report-store-empty">
                      Belum ada barang di toko ini.
                    </p>
                  ) : (
                    <div className="ss-table-wrap">
                      <table className="ss-table report-store-table">
                        <thead>
                          <tr>
                            <th scope="col">Barang</th>
                            <th scope="col">Terjual</th>
                            <th scope="col">Sisa stok</th>
                            <th scope="col">Tanggal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {store.items.map((item) => (
                            <tr key={item.productId}>
                              <td>
                                <div>
                                  <p className="ss-strong">{item.name}</p>
                                  <p className="ss-meta">
                                    {item.sku ?? "Tanpa kode"}
                                  </p>
                                </div>
                              </td>
                              <td className="ss-tabular">
                                {formatQuantity(item.sold)} {item.unit}
                              </td>
                              <td className="ss-tabular">
                                {formatQuantity(item.currentStock)} {item.unit}
                              </td>
                              <td className="ss-tabular">
                                {item.lastOutDate
                                  ? formatDateOnly(item.lastOutDate)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </>
        ) : mutations.length === 0 ? (
          <div className="ss-empty">
            <p className="ss-empty-title">
              <FileSearch aria-hidden="true" />
              Tidak ada mutasi
            </p>
            <p>Tidak ada mutasi pada periode dan toko yang dipilih.</p>
            <button
              type="button"
              className="ss-btn ss-btn-outline ss-btn-sm"
              onClick={resetFilters}
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
                    <th scope="col">Tanggal</th>
                    <th scope="col">Barang</th>
                    <th scope="col">Toko</th>
                    <th scope="col">Jenis</th>
                    <th scope="col">Jumlah</th>
                    <th scope="col">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {mutations.map((item) => (
                    <tr key={item.id}>
                      <td className="ss-tabular">
                        {formatDateOnly(item.movementDate)}
                      </td>
                      <td>
                        <div>
                          <p className="ss-strong">{item.productName}</p>
                          <p className="ss-meta">{item.sku ?? "Tanpa kode"}</p>
                        </div>
                      </td>
                      <td>{item.storeName}</td>
                      <td>{typeBadge(item.type)}</td>
                      <td className="ss-tabular">
                        {signedQty(item.type, item.quantity, item.unit)}
                      </td>
                      <td className="report-cell-note">{item.note}</td>
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
