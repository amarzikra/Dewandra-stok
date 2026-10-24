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
import { postJson } from "@/lib/http-client";
import { productUnitOptions, type StoreOption } from "@/lib/inventory-types";

export function ProductDialog({
  open,
  onOpenChange,
  stores,
  initialStoreId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreOption[];
  initialStoreId?: string;
  onSaved: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const wasOpen = useRef(false);
  const nameId = useId();
  const skuId = useId();
  const categoryId = useId();
  const unitId = useId();
  const purchasePriceId = useId();
  const sellingPriceId = useId();
  const minStockId = useId();
  const errorId = useId();
  const [storeId, setStoreId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !wasOpen.current) {
      formRef.current?.reset();
      setStoreId(initialStoreId ?? stores[0]?.id ?? "");
      setError(null);
      setPending(false);
    }
    wasOpen.current = open;
  }, [open, initialStoreId, stores]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const product = await postJson<{ name: string }>("/api/products", {
        storeId,
        name: String(data.get("name") ?? ""),
        sku: String(data.get("sku") ?? ""),
        category: String(data.get("category") ?? ""),
        unit: String(data.get("unit") ?? ""),
        purchasePrice: Number(data.get("purchasePrice") ?? 0),
        sellingPrice: Number(data.get("sellingPrice") ?? 0),
        minStock: Number(data.get("minStock") ?? 0),
      });
      onOpenChange(false);
      onSaved(`Barang “${product.name}” ditambahkan.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Barang gagal disimpan. Coba lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah barang</DialogTitle>
          <DialogDescription>
            Isi data dasar barang. Stok awal 0, lalu catat barang masuk untuk
            menambah stok.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="product-store">Toko</Label>
            <NativeSelect
              id="product-store"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
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

          <div className="grid gap-1.5">
            <Label htmlFor={nameId}>Nama barang</Label>
            <Input
              id={nameId}
              name="name"
              placeholder="Contoh: Pupuk Urea 50 kg"
              maxLength={160}
              required
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={skuId}>
                Kode barang{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </Label>
              <Input
                id={skuId}
                name="sku"
                placeholder="PPK-001"
                maxLength={60}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={categoryId}>
                Kategori{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </Label>
              <Input
                id={categoryId}
                name="category"
                placeholder="Pupuk"
                maxLength={80}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={unitId}>Satuan</Label>
              <NativeSelect id={unitId} name="unit" defaultValue="pcs" required>
                {productUnitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={purchasePriceId}>Harga beli</Label>
              <Input
                id={purchasePriceId}
                name="purchasePrice"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={sellingPriceId}>Harga jual</Label>
              <Input
                id={sellingPriceId}
                name="sellingPrice"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={minStockId}>Batas stok minimum</Label>
              <Input
                id={minStockId}
                name="minStock"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
          </div>

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
            <Button type="submit" disabled={pending || !storeId}>
              {pending ? "Menyimpan…" : "Simpan barang"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
