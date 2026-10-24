import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

async function signUp(client: APIRequestContext) {
  const data = {
    name: "Pemilik Toko",
    email: `stok-${randomUUID()}@example.com`,
    password: "Stok-test-password-123!",
  };
  let response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  if (response.status() === 429) {
    const seconds = Number(response.headers()["retry-after"] || 10);
    expect(Number.isFinite(seconds) && seconds >= 0 && seconds <= 10).toBe(
      true,
    );
    await delay((seconds + 0.1) * 1000);
    response = await client.post("/api/auth/sign-up/email", { headers, data });
  }
  expect(response.status()).toBe(200);
}

test("inventory APIs require a session, validate input, and keep stock in sync", async ({
  request,
}) => {
  for (const [method, url] of [
    ["GET", "/api/dashboard"],
    ["GET", "/api/products?q=pupuk"],
    ["POST", "/api/products"],
    ["POST", "/api/stock-movements"],
  ]) {
    const response = await request.fetch(url, { method, headers });
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  }

  await signUp(request);
  const baseline = await (await request.get("/api/dashboard")).json();
  expect(baseline.data.stores).toHaveLength(5);
  expect(
    baseline.data.stores.map((store: { name: string }) => store.name),
  ).toEqual(
    expect.arrayContaining([
      "Toko Pupuk",
      "Toko Bangunan",
      "Toko ATK",
      "Toko Listrik",
      "Toko Furniture",
    ]),
  );

  const storeId = baseline.data.stores[0].id;
  const suffix = randomUUID().slice(0, 8);
  const name = `Pupuk API ${suffix}`;
  const created = await request.post("/api/products", {
    headers,
    data: {
      storeId,
      name,
      sku: `API-${suffix}`,
      category: "Pupuk",
      unit: "karung",
      purchasePrice: 350_000,
      sellingPrice: 400_000,
      minStock: 100,
    },
  });
  expect(created.status()).toBe(201);
  const { data: product } = await created.json();
  expect(product.name).toBe(name);
  expect(product.sku).toBe(`API-${suffix}`);
  expect(product.currentStock).toBe(0);

  const duplicate = await request.post("/api/products", {
    headers,
    data: {
      storeId,
      name: "Kode ganda",
      sku: `API-${suffix}`,
      unit: "karung",
    },
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).error.code).toBe("DUPLICATE_SKU");

  const movement = await request.post("/api/stock-movements", {
    headers,
    data: {
      type: "in",
      productId: product.id,
      quantity: 25,
      movementDate: "2026-10-24",
      note: "Nota uji",
    },
  });
  expect(movement.status()).toBe(201);
  const incoming = (await movement.json()).data;
  expect(incoming).toMatchObject({
    productName: name,
    unit: "karung",
    quantity: 25,
    currentStock: 25,
  });

  const after = (await (await request.get("/api/dashboard")).json()).data;
  expect(after.totals.productCount).toBe(baseline.data.totals.productCount + 1);
  expect(after.totals.stockValue).toBe(
    baseline.data.totals.stockValue + 350_000 * 25,
  );
  expect(after.totals.lowStockCount).toBe(
    baseline.data.totals.lowStockCount + 1,
  );
  expect(
    after.lowStock.some((row: { id: string }) => row.id === product.id),
  ).toBe(true);
  expect(after.recent[0]).toMatchObject({
    productName: name,
    quantity: 25,
    movementDate: "2026-10-24",
    storeCode: baseline.data.stores[0].code,
  });

  const search = await (
    await request.get(`/api/products?q=${encodeURIComponent(suffix)}`)
  ).json();
  expect(search.data).toHaveLength(1);
  expect(search.data[0]).toMatchObject({
    id: product.id,
    name,
    currentStock: 25,
    storeCode: baseline.data.stores[0].code,
  });

  const byStore = await (
    await request.get(`/api/products?storeId=${storeId}&limit=100`)
  ).json();
  expect(
    byStore.data.some((row: { id: string }) => row.id === product.id),
  ).toBe(true);

  for (const data of [
    {
      type: "in",
      productId: product.id,
      quantity: 0,
      movementDate: "2026-10-24",
    },
    {
      type: "in",
      productId: product.id,
      quantity: 5,
      movementDate: "2026-02-30",
    },
    {
      type: "in",
      productId: product.id,
      quantity: 5,
      movementDate: "2026-10-24",
      note: "x".repeat(501),
    },
    {
      type: "in",
      productId: randomUUID(),
      quantity: 5,
      movementDate: "2026-10-24",
    },
  ]) {
    const response = await request.post("/api/stock-movements", {
      headers,
      data,
    });
    if (data.productId === product.id) expect(response.status()).toBe(422);
    else expect(response.status()).toBe(404);
  }

  const wrongOrigin = await request.post("/api/products", {
    headers: { Origin: "https://untrusted.example" },
    data: { storeId, name: "Ditolak", unit: "pcs" },
  });
  expect(wrongOrigin.status()).toBe(403);
});

test("the dashboard records the first incoming stock from a phone-sized screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page.request);

  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "Ringkasan stok" }),
  ).toBeVisible();
  for (const name of [
    "Toko Pupuk",
    "Toko Bangunan",
    "Toko ATK",
    "Toko Listrik",
    "Toko Furniture",
  ])
    await expect(page.getByRole("heading", { name })).toBeVisible();

  const suffix = randomUUID().slice(0, 6);
  const productName = `Pupuk Uji ${suffix}`;

  await page
    .getByRole("button", { name: "Tambah barang", exact: true })
    .click();
  const productDialog = page.getByRole("dialog");
  await expect(
    productDialog.getByRole("heading", { name: "Tambah barang" }),
  ).toBeVisible();
  await expect(
    productDialog.getByLabel("Toko").locator("option:checked"),
  ).toHaveText("Toko ATK");
  await productDialog.getByLabel("Nama barang").fill(productName);
  await productDialog.getByLabel("Kode barang").fill(`UJI-${suffix}`);
  await productDialog.getByLabel("Kategori").fill("Pupuk");
  await productDialog.getByLabel("Satuan").selectOption("karung");
  await productDialog.getByLabel("Harga beli").fill("350000");
  await productDialog.getByLabel("Harga jual").fill("400000");
  await productDialog.getByLabel("Batas stok minimum").fill("50");
  await productDialog.getByRole("button", { name: "Simpan barang" }).click();
  await expect(productDialog).toBeHidden();
  await expect(page.getByText(/ditambahkan/).first()).toBeVisible();

  await page
    .getByRole("button", { name: "Catat barang masuk", exact: true })
    .click();
  const movementDialog = page.getByRole("dialog");
  await expect(
    movementDialog.getByRole("heading", { name: "Catat barang masuk" }),
  ).toBeVisible();
  await expect(
    movementDialog.getByLabel("Toko").locator("option:checked"),
  ).toHaveText("Toko ATK");
  await movementDialog
    .getByLabel("Barang")
    .selectOption({ label: `${productName} — stok 0 karung` });
  await movementDialog.getByLabel("Jumlah masuk").fill("12");
  await movementDialog
    .getByRole("button", { name: "Simpan barang masuk" })
    .click();
  await expect(movementDialog).toBeHidden();
  await expect(
    page
      .getByText(
        `Stok ${productName} bertambah 12 karung. Stok sekarang 12 karung.`,
      )
      .first(),
  ).toBeVisible();

  const restock = page.getByRole("region", { name: "Perlu restock" });
  await expect(restock.getByText(productName).first()).toBeVisible();
  await expect(restock.getByText("Menipis").first()).toBeVisible();
  await expect(restock.getByText(/min 50 karung/).first()).toBeVisible();

  const recent = page.getByRole("region", { name: "Pergerakan terakhir" });
  await expect(recent.getByText("+12 karung").first()).toBeVisible();
  await expect(recent.getByText(productName).first()).toBeVisible();

  const chart = page.getByRole("figure", { name: "Arus stok" });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole("button")).toHaveCount(7);
  await chart.getByRole("button").last().hover();
  const tooltip = chart.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText("Masuk")).toBeVisible();
  await expect(tooltip.getByText("Keluar")).toBeVisible();
  await expect(tooltip.locator("dd")).toHaveCount(2);

  const search = page.getByRole("region", { name: "Cari barang" });
  await page.getByRole("searchbox", { name: "Cari barang" }).fill(suffix);
  await expect(search.getByText(productName).first()).toBeVisible();
  await expect(search.getByText("Toko ATK").first()).toBeVisible();
  await page.getByRole("button", { name: "Hapus pencarian" }).click();
  await expect(search.getByText(productName)).toBeHidden();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
