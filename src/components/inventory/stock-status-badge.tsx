import { CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { stockState } from "@/lib/inventory-types";

export function StockStatusBadge({
  currentStock,
  minStock,
  className,
}: {
  currentStock: number;
  minStock: number;
  className?: string;
}) {
  const state = stockState(currentStock, minStock);
  if (state === "ok") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        state === "out"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning-border bg-warning-surface text-warning",
        className,
      )}
    >
      {state === "out" ? (
        <CircleAlert className="size-3" aria-hidden="true" />
      ) : (
        <TriangleAlert className="size-3" aria-hidden="true" />
      )}
      {state === "out" ? "Habis" : "Menipis"}
    </span>
  );
}
