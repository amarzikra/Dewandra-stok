import { Check, CircleAlert, TriangleAlert } from "lucide-react";
import { stockState } from "@/lib/inventory-types";

export function StockPill({
  currentStock,
  minStock,
}: {
  currentStock: number;
  minStock: number;
}) {
  const state = stockState(currentStock, minStock);

  if (state === "out")
    return (
      <span className="ss-pill ss-pill-danger">
        <CircleAlert aria-hidden="true" />
        Habis
      </span>
    );

  if (state === "low")
    return (
      <span className="ss-pill ss-pill-warning">
        <TriangleAlert aria-hidden="true" />
        Menipis
      </span>
    );

  return (
    <span className="ss-pill ss-pill-success">
      <Check aria-hidden="true" />
      Aman
    </span>
  );
}
