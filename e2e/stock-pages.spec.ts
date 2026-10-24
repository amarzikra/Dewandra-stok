import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

async function signUp(client: APIRequestContext) {
  const data = {
    name: "Pemilik Halaman",
    email: `frontend-${randomUUID()}@example.com`,
    password: "Frontend-test-password-123!",
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

test("the stock pages record and report real PostgreSQL data", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signUp(page.request);

  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Ringkasan stok", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ss-link")).toHaveCount(8);
  await expect(page.locator(".ss-user-name")).toContainText("Pemilik Halaman");
  for (const name of [
    "Toko Pupuk",
    "Toko Bangunan",
    "Toko ATK",
    "Toko Listrik",
    "Toko Furniture",
  ])
    await expect(page.getByRole("heading", { name })).toBeVisible();

  const suffix = randomUUID().slice(0, 6);
  const productName = `Produk Halaman ${suffix}`;

  await page.getByRole("link", { name: "Barang", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/barang$/);
  await expect(
    page.getByRole("heading", { name: "Katalog barang", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Tambah barang", exact: true })
    .click();
  const productDialog = page.getByRole("dialog");
  await expect(productDialog).toBeVisible();
  await productDialog.getByLabel("Toko").selectOption({ label: "Toko ATK" });
  await productDialog.getByLabel("Nama barang").fill(productName);
  await productDialog.getByLabel("Kode barang").fill(`HAL-${suffix}`);
  await productDialog.getByLabel("Satuan").selectOption("pcs");
  await productDialog.getByLabel("Harga beli").fill("15000");
  await productDialog.getByLabel("Harga jual").fill("20000");
  await productDialog.getByLabel("Batas stok minimum").fill("5");
  await productDialog.getByRole("button", { name: "Simpan barang" }).click();
  await expect(page.locator(".ss-toast-text")).toContainText("ditambahkan");

  await page.getByLabel("Cari barang").fill(suffix);
  const catalogRow = page.locator(".ss-table tbody tr").filter({
    hasText: productName,
  });
  await expect(catalogRow).toHaveCount(1);
  await expect(catalogRow.getByText("Habis")).toBeVisible();
  await expect(catalogRow.getByText("Toko ATK")).toBeVisible();

  await page.getByRole("link", { name: "Barang masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/masuk$/);
  await page.locator("#masuk-store").selectOption({ label: "Toko ATK" });
  await page
    .locator("#masuk-product")
    .selectOption({ label: `${productName} — stok 0 pcs` });
  await page.locator("#masuk-quantity").fill("12");
  await page.getByRole("button", { name: "Simpan barang masuk" }).click();
  await expect(page.locator(".ss-toast-text")).toContainText(
    "bertambah 12 pcs",
  );
  const incomingRow = page.locator(".ss-table tbody tr").filter({
    hasText: productName,
  });
  await expect(incomingRow).toHaveCount(1);
  await expect(incomingRow.getByText("+12 pcs")).toBeVisible();
  await expect(incomingRow.getByText("Tercatat")).toBeVisible();

  await page.getByRole("link", { name: "Barang keluar", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/keluar$/);
  await page.locator("#keluar-store").selectOption({ label: "Toko ATK" });
  await page
    .locator("#keluar-product")
    .selectOption({ label: `${productName} — stok 12 pcs` });
  await page.locator("#keluar-quantity").fill("2");
  await page.getByRole("button", { name: "Simpan barang keluar" }).click();
  await expect(page.locator(".ss-toast-text")).toContainText("berkurang 2 pcs");
  await expect(
    page
      .locator(".ss-table tbody tr")
      .filter({ hasText: productName })
      .getByText("−2 pcs"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Retur", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/retur$/);
  await page.getByRole("button", { name: "Dari pelanggan" }).click();
  await page.locator("#retur-store").selectOption({ label: "Toko ATK" });
  await page
    .locator("#retur-product")
    .selectOption({ label: `${productName} — stok 10 pcs` });
  await page.locator("#retur-quantity").fill("1");
  await page.locator("#retur-reason").fill("Pelanggan membatalkan pesanan");
  await page.getByRole("button", { name: "Simpan retur" }).click();
  await expect(page.locator(".ss-toast-text")).toContainText(
    "Retur dari pelanggan dicatat",
  );
  const returnRow = page.locator(".ss-table tbody tr").filter({
    hasText: productName,
  });
  await expect(returnRow).toHaveCount(1);
  await expect(returnRow.getByText("+1 pcs")).toBeVisible();

  await page.getByRole("link", { name: "Stock opname", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/opname$/);
  await page.locator("#opname-store").selectOption({ label: "Toko ATK" });
  const opnameRow = page.locator(".ss-table tbody tr").filter({
    hasText: productName,
  });
  await expect(opnameRow).toHaveCount(1);
  await opnameRow.getByLabel(`Hitung fisik ${productName}`).fill("20");
  await expect(opnameRow.getByText("Lebih 9")).toBeVisible();
  await page.getByRole("button", { name: "Simpan penyesuaian" }).click();
  await expect(page.locator(".ss-toast-text")).toContainText(
    "Penyesuaian disimpan",
  );
  await expect(
    page.locator(".ss-table tbody tr").filter({ hasText: productName }),
  ).toHaveCount(2);

  await page.getByRole("link", { name: "Laporan", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/laporan$/);
  await expect(
    page.getByRole("heading", { name: "Laporan", exact: true }),
  ).toBeVisible();

  const atkReport = page
    .locator(".report-store-block")
    .filter({ hasText: "Toko ATK" });
  await expect(atkReport).toHaveCount(1);
  const reportRow = atkReport.locator("tbody tr").filter({
    hasText: productName,
  });
  await expect(reportRow).toHaveCount(1);
  await expect(reportRow).toContainText("2 pcs");
  await expect(reportRow).toContainText("20 pcs");
  await expect(reportRow).toContainText("24 Okt 2026");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Ekspor Excel" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("laporan-stok.csv");

  await page.getByRole("button", { name: "Mutasi barang" }).click();
  await expect(
    page.locator(".ss-table tbody tr").filter({ hasText: productName }).first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".ss-table tbody tr")
      .filter({ hasText: "Penyesuaian" })
      .first(),
  ).toBeVisible();

  await page.getByRole("link", { name: "Pengaturan", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/pengaturan$/);
  await expect(page.locator(".settings-store")).toHaveCount(5);
  await page.getByRole("button", { name: "Ubah Toko ATK" }).click();
  const storeDialog = page.getByRole("dialog");
  await expect(storeDialog).toBeVisible();
  await storeDialog.getByLabel("Nama toko").fill("Toko ATK Uji");
  await storeDialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.locator(".ss-toast-text")).toContainText("diperbarui");
  await expect(
    page.locator(".settings-store").filter({ hasText: "Toko ATK Uji" }),
  ).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Barang", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/barang$/);
  await expect(page.locator(".ss-sidebar")).toHaveCSS("width", "68px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});
