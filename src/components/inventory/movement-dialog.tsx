import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatQuantity, todayInputValue } from "@/lib/format";
import { getJson, postJson } from "@/lib/http-client";
import type { ProductOption, StoreOption } from "@/lib/inventory-types";

type IncomingResult = {
  productName: string;
  unit: string;
  quantity: number;
  currentStock: number;
};

export function MovementDialog({
  open,
  onOpenChange,
  stores,
  initialProduct,
  onSaved,
  onRequestAddProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreOption[];
  initialProduct?: ProductOption | null;
  onSaved: (message: string) => void;
  onRequestAddProduct: (storeId: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const wasOpen = useRef(false);
  const productId = useId();
  const quantityId = useId();
  const dateId = useId();
  const noteId = useId();
  const errorId = useId();
  const [storeId, setStoreId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loaded, setLoaded] = useState<{
    storeId: string;
    products: ProductOption[];
  } | null>(null);
  const [loadError, setLoadError] = useState<{
    storeId: string;
    message: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [movementDate, setMovementDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !wasOpen.current) {
      formRef.current?.reset();
      setStoreId(initialProduct?.storeId ?? stores[0]?.id ?? "");
      setSelectedId(initialProduct?.id ?? "");
      setMovementDate(todayInputValue());
      setError(null);
      setPending(false);
    }
    wasOpen.current = open;
  }, [open, initialProduct, stores]);

  useEffect(() => {
    if (!open || !storeId) return;
    const controller = new AbortController();
    getJson<ProductOption[]>(
      `/api/products?storeId=${storeId}&limit=100`,
      controller.signal,
    )
      .then((rows) => {
        if (controller.signal.aborted) return;
        const next = [...rows];
        if (
          initialProduct &&
          initialProduct.storeId === storeId &&
          !next.some((product) => product.id === initialProduct.id)
        )
          next.unshift(initialProduct);
        setLoaded({ storeId, products: next });
        setLoadError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError({
          storeId,
          message:
            caught instanceof Error
              ? caught.message
              : "Daftar barang gagal dimuat.",
        });
      });
    return () => controller.abort();
  }, [open, storeId, reloadKey, initialProduct]);

  const loadErrorForStore =
    loadError?.storeId === storeId ? loadError.message : null;
  const products = loaded?.storeId === storeId ? loaded.products : [];
  const loading =
    open &&
    Boolean(storeId) &&
    loaded?.storeId !== storeId &&
    !loadErrorForStore;
  const selected = products.find((product) => product.id === selectedId);
  const selectedUnit = selected?.unit ?? "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await postJson<IncomingResult>("/api/stock-movements", {
        type: "in",
        productId: selectedId,
        quantity: Number(data.get("quantity") ?? 0),
        movementDate,
        note: String(data.get("note") ?? ""),
      });
      onOpenChange(false);
      onSaved(
        `Stok ${result.productName} bertambah ${formatQuantity(result.quantity)} ${result.unit}. Stok sekarang ${formatQuantity(result.currentStock)} ${result.unit}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Barang masuk gagal disimpan. Coba lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat barang masuk</DialogTitle>
          <DialogDescription>
            Stok barang langsung bertambah setelah disimpan.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="movement-store">Toko</Label>
            <NativeSelect
              id="movement-store"
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                setSelectedId("");
                setError(null);
              }}
              required
              disabled={stores.length === 0}
            >
              {stores.length === 0 && (
                <option value="">Toko belum tersedia</option>
              )}
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Memuat barang…
            </p>
          ) : loadErrorForStore ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p role="alert">{loadErrorForStore}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setLoadError(null);
                  setReloadKey((key) => key + 1);
                }}
              >
                Coba lagi
              </Button>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              <p>Belum ada barang di toko ini.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onRequestAddProduct(storeId)}
              >
                Tambah barang
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor={productId}>Barang</Label>
                <NativeSelect
                  id={productId}
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Pilih barang
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — stok{" "}
                      {formatQuantity(product.currentStock)} {product.unit}
                    </option>
                  ))}
                </NativeSelect>
                {selected && (
                  <p className="text-xs text-muted-foreground">
                    Stok saat ini {formatQuantity(selected.currentStock)}{" "}
                    {selected.unit}.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={quantityId}>Jumlah masuk</Label>
                  <div className="relative">
                    <Input
                      id={quantityId}
                      name="quantity"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      required
                      className="pr-20"
                      aria-describedby={error ? errorId : undefined}
                    />
                    {selectedUnit && (
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                        {selectedUnit}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={dateId}>Tanggal</Label>
                  <Input
                    id={dateId}
                    name="movementDate"
                    type="date"
                    value={movementDate}
                    onChange={(event) => setMovementDate(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={noteId}>
                  Keterangan{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </Label>
                <Input
                  id={noteId}
                  name="note"
                  maxLength={500}
                  placeholder="Nomor nota atau catatan"
                />
              </div>
            </>
          )}

          {error && (
            <p
              id={errorId}
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Batal
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                pending ||
                loading ||
                Boolean(loadErrorForStore) ||
                products.length === 0 ||
                !storeId
              }
            >
              {pending ? "Menyimpan…" : "Simpan barang masuk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
