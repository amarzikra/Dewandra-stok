import { useState } from "react";
import { formatDateOnly, formatQuantity } from "@/lib/format";
import type { DailyMovement } from "@/lib/inventory-types";

const weekday = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  timeZone: "UTC",
});

function tooltipAlignment(index: number, length: number) {
  if (index === 0) return "left-0";
  if (index === length - 1) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

export function StockFlowChart({ data }: { data: DailyMovement[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxValue = Math.max(
    0,
    ...data.flatMap((day) => [day.incoming, day.outgoing]),
  );
  const scaleMax = Math.max(maxValue, 1);
  const total = data.reduce((sum, day) => sum + day.incoming + day.outgoing, 0);

  return (
    <figure
      aria-labelledby="stock-flow-heading"
      className="rounded-xl border bg-card px-4 py-5 sm:px-5"
    >
      <figcaption className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="stock-flow-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Arus stok
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Barang masuk dan keluar 7 hari terakhir. Total kuantitas gabungan
            semua satuan.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "var(--stok-success)" }}
            />
            Masuk
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "var(--stok-accent)" }}
            />
            Keluar
          </span>
        </div>
      </figcaption>

      <div className="mt-6 flex gap-2 sm:gap-3">
        <div
          aria-hidden="true"
          className="flex h-48 shrink-0 flex-col justify-between text-right text-[11px] leading-none text-muted-foreground tabular-nums sm:h-60"
        >
          <span>{formatQuantity(maxValue)}</span>
          <span>{formatQuantity(Math.round(maxValue / 2))}</span>
          <span>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-48 border-b border-border sm:h-60">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex flex-col justify-between"
            >
              {[0, 1, 2].map((line) => (
                <span
                  key={line}
                  className="border-t border-dashed border-border/70"
                />
              ))}
            </div>

            <div className="relative flex h-full items-end gap-1 sm:gap-2">
              {data.map((day, index) => {
                const active = activeIndex === index;
                const incomingHeight =
                  day.incoming > 0
                    ? Math.max((day.incoming / scaleMax) * 100, 1.5)
                    : 0;
                const outgoingHeight =
                  day.outgoing > 0
                    ? Math.max((day.outgoing / scaleMax) * 100, 1.5)
                    : 0;
                const tooltipId = `stock-flow-tooltip-${day.date}`;

                return (
                  <div
                    key={day.date}
                    className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
                  >
                    <div className="flex h-full items-end justify-center gap-1 sm:gap-1.5">
                      <span
                        className="w-2.5 rounded-t-[3px] motion-safe:transition-opacity sm:w-3"
                        style={{
                          height: `${incomingHeight}%`,
                          backgroundColor: "var(--stok-success)",
                          opacity: activeIndex === null || active ? 1 : 0.55,
                        }}
                      />
                      <span
                        className="w-2.5 rounded-t-[3px] motion-safe:transition-opacity sm:w-3"
                        style={{
                          height: `${outgoingHeight}%`,
                          backgroundColor: "var(--stok-accent)",
                          opacity: activeIndex === null || active ? 1 : 0.55,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="absolute inset-0 z-10 cursor-pointer rounded-md"
                      aria-label={`${formatDateOnly(day.date)}: masuk ${formatQuantity(day.incoming)} unit, keluar ${formatQuantity(day.outgoing)} unit`}
                      aria-describedby={active ? tooltipId : undefined}
                      onClick={() => setActiveIndex(index)}
                      onPointerEnter={() => setActiveIndex(index)}
                      onPointerLeave={() => setActiveIndex(null)}
                      onFocus={() => setActiveIndex(index)}
                      onBlur={() => setActiveIndex(null)}
                    />

                    {active && (
                      <div
                        id={tooltipId}
                        role="tooltip"
                        className={`pointer-events-none absolute bottom-full z-20 mb-3 w-44 rounded-lg border bg-card p-3 text-left shadow-lg ${tooltipAlignment(index, data.length)}`}
                      >
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDateOnly(day.date)}
                        </p>
                        <dl className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                aria-hidden="true"
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor: "var(--stok-success)",
                                }}
                              />
                              Masuk
                            </dt>
                            <dd className="font-semibold tabular-nums">
                              {formatQuantity(day.incoming)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                aria-hidden="true"
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor: "var(--stok-accent)",
                                }}
                              />
                              Keluar
                            </dt>
                            <dd className="font-semibold tabular-nums">
                              {formatQuantity(day.outgoing)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex gap-1 sm:gap-2">
            {data.map((day, index) => (
              <span
                key={day.date}
                className={
                  index === data.length - 1
                    ? "min-w-0 flex-1 text-center text-[11px] font-semibold text-foreground"
                    : "min-w-0 flex-1 text-center text-[11px] text-muted-foreground"
                }
              >
                {weekday.format(new Date(`${day.date}T00:00:00Z`))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {total === 0 && (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Belum ada barang masuk atau keluar dalam 7 hari terakhir.
        </p>
      )}
    </figure>
  );
}
