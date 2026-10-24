import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatQuantity } from "@/lib/format";
import type { ProductSearchResult } from "@/lib/inventory-types";
import { StockStatusBadge } from "./stock-status-badge";

type SearchState = "idle" | "loading" | "done" | "error";

export function ProductSearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const term = query.trim();

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim()) {
      setState("loading");
    } else {
      setResults([]);
      setState("idle");
    }
  }

  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/products?q=${encodeURIComponent(term)}&limit=8`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const body = (await response.json()) as {
          data: ProductSearchResult[];
        };
        setResults(body.data);
        setState("done");
      } catch {
        if (controller.signal.aborted) return;
        setState("error");
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  return (
    <section
      aria-labelledby="search-heading"
      className="rounded-xl border bg-card p-4 sm:p-5"
    >
      <h2 id="search-heading" className="text-lg font-semibold tracking-tight">
        Cari barang
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Nama atau kode barang, di semua toko.
      </p>
      <div className="relative mt-4">
        <Label htmlFor={inputId} className="sr-only">
          Cari barang
        </Label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="pupuk urea atau PPK-001"
          autoComplete="off"
          className="pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => updateQuery("")}
            aria-label="Hapus pencarian"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="mt-3" aria-live="polite">
        {state === "loading" && (
          <p role="status" className="text-sm text-muted-foreground">
            Mencari…
          </p>
        )}
        {state === "error" && (
          <p role="alert" className="text-sm text-destructive">
            Pencarian gagal. Periksa koneksi lalu coba lagi.
          </p>
        )}
        {state === "done" && results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Tidak ada barang yang cocok dengan “{term}”.
          </p>
        )}
        {state === "done" && results.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-lg border">
            {results.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-6">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.storeName}
                    {product.sku ? ` · ${product.sku}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    <span className="font-medium text-foreground">
                      {formatQuantity(product.currentStock)}
                    </span>{" "}
                    {product.unit}
                  </p>
                  <StockStatusBadge
                    currentStock={product.currentStock}
                    minStock={product.minStock}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
