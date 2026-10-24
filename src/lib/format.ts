const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const quantity = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const longDate = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export function formatRupiah(value: number) {
  return rupiah.format(value);
}

export function formatQuantity(value: number) {
  return quantity.format(value);
}

export function formatDateOnly(value: string) {
  return shortDate.format(new Date(`${value}T00:00:00Z`));
}

export function formatLongDate(iso: string) {
  return longDate.format(new Date(iso));
}

export function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
