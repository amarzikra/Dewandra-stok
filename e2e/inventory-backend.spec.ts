import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  expect,
  test,
  request as apiRequest,
  type APIRequestContext,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

async function signUp(client: APIRequestContext, name = "Pemilik Backend") {
  const data = {
    name,
    email: `backend-${randomUUID()}@example.com`,
    password: "Backend-test-password-123!",
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
  return data.email;
}

test("stock rules, returns, opname, reports, and store access stay in sync", async ({
  request,
}) => {
  await signUp(request);

  const stores = (await (await request.get("/api/stores")).json()).data as {
    id: string;
  }[];
  expect(stores).toHaveLength(5);
  const storeId = stores[0].id;

  const suffix = randomUUID().slice(0, 8);
  const productName = `Barang Uji ${suffix}`;
  const product = (
    await (
      await request.post("/api/products", {
        headers,
        data: {
          storeId,
          name: productName,
          sku: `BE-${suffix}`,
          unit: "pcs",
          purchasePrice: 1_000,
          sellingPrice: 1_500,
          minStock: 5,
        },
      })
    ).json()
  ).data;
  expect(product.currentStock).toBe(0);

  const incoming = await request.post("/api/stock-movements", {
    headers,
    data: {
      type: "in",
      productId: product.id,
      quantity: 10,
      movementDate: "2026-10-24",
      note: "Nota masuk",
    },
  });
  expect(incoming.status()).toBe(201);
  expect((await incoming.json()).data.currentStock).toBe(10);

  const outgoing = await request.post("/api/stock-movements", {
    headers,
    data: {
      type: "out",
      productId: product.id,
      quantity: 3,
      movementDate: "2026-10-24",
      note: "Penjualan",
    },
  });
  expect((await outgoing.json()).data.currentStock).toBe(7);

  const oversell = await request.post("/api/stock-movements", {
    headers,
    data: {
      type: "out",
      productId: product.id,
      quantity: 999,
      movementDate: "2026-10-24",
    },
  });
  expect(oversell.status()).toBe(422);
  expect((await oversell.json()).error.code).toBe("INSUFFICIENT_STOCK");

  const outgoingRows = (
    await (await request.get("/api/stock-movements?type=out&limit=10")).json()
  ).data as { id: string; productId: string }[];
  const movement = outgoingRows.find((row) => row.productId === product.id)!;
  const voided = await request.post(
    `/api/stock-movements/${movement.id}/void`,
    { headers, data: {} },
  );
  expect(voided.status()).toBe(200);
  expect((await voided.json()).data.currentStock).toBe(10);
  expect(
    (
      await request.post(`/api/stock-movements/${movement.id}/void`, {
        headers,
        data: {},
      })
    ).status(),
  ).toBe(404);

  const supplierReturn = await request.post("/api/returns", {
    headers,
    data: {
      productId: product.id,
      type: "to_supplier",
      quantity: 2,
      reason: "Kemasan rusak",
      returnDate: "2026-10-24",
    },
  });
  expect(supplierReturn.status()).toBe(201);
  expect((await supplierReturn.json()).data.currentStock).toBe(8);

  const customerReturn = await request.post("/api/returns", {
    headers,
    data: {
      productId: product.id,
      type: "from_customer",
      quantity: 1,
      reason: "Batal pesan",
      returnDate: "2026-10-24",
    },
  });
  expect((await customerReturn.json()).data.currentStock).toBe(9);

  const sale = await request.post("/api/stock-movements", {
    headers,
    data: {
      type: "out",
      productId: product.id,
      quantity: 2,
      movementDate: "2026-10-24",
      note: "Penjualan hari ini",
    },
  });
  expect((await sale.json()).data.currentStock).toBe(7);

  const opname = await request.post("/api/opnames", {
    headers,
    data: {
      storeId,
      opnameDate: "2026-10-24",
      note: "Hitung gudang",
      items: [{ productId: product.id, physicalQty: 4 }],
    },
  });
  expect(opname.status()).toBe(201);
  const opnameResult = (await opname.json()).data;
  expect(opnameResult).toMatchObject({
    itemCount: 1,
    adjustmentCount: 1,
  });
  expect(opnameResult.summary).toContain(productName);

  const duplicateOpnameItem = await request.post("/api/opnames", {
    headers,
    data: {
      storeId,
      opnameDate: "2026-10-24",
      items: [
        { productId: product.id, physicalQty: 1 },
        { productId: product.id, physicalQty: 2 },
      ],
    },
  });
  expect(duplicateOpnameItem.status()).toBe(422);

  const products = (
    await (await request.get(`/api/products?q=${suffix}`)).json()
  ).data;
  expect(products).toHaveLength(1);
  expect(products[0].currentStock).toBe(4);

  const stockReport = (
    await (
      await request.get("/api/reports?type=stock&from=2026-10-24&to=2026-10-24")
    ).json()
  ).data;
  expect(stockReport.period).toEqual({
    from: "2026-10-24",
    to: "2026-10-24",
  });
  const reportStore = stockReport.stores.find(
    (row: { id: string }) => row.id === storeId,
  );
  const reportItem = reportStore.items.find(
    (row: { productId: string }) => row.productId === product.id,
  );
  expect(reportItem).toMatchObject({
    sold: 2,
    currentStock: 4,
    lastOutDate: "2026-10-24",
  });
  expect(stockReport.totals.sold).toBeGreaterThanOrEqual(2);

  const dashboard = (await (await request.get("/api/dashboard")).json()).data;
  expect(
    dashboard.lowStock.some((row: { id: string }) => row.id === product.id),
  ).toBe(true);
  expect(dashboard.recent[0].type).toBe("adjustment");
  expect(dashboard.dailyMovements).toHaveLength(7);
  expect(dashboard.dailyMovements.at(-1)).toEqual({
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    incoming: expect.any(Number),
    outgoing: expect.any(Number),
  });

  const mutationReport = (
    await (
      await request.get(
        "/api/reports?type=mutation&from=2026-10-01&to=2026-10-31",
      )
    ).json()
  ).data;
  expect(
    mutationReport.movements.some(
      (row: { productId: string; type: string }) =>
        row.productId === product.id &&
        ["in", "return_in", "return_out", "adjustment"].includes(row.type),
    ),
  ).toBe(true);
  expect(
    mutationReport.movements.some(
      (row: { productId: string; type: string; quantity: number }) =>
        row.productId === product.id &&
        row.type === "out" &&
        row.quantity === 2,
    ),
  ).toBe(true);

  const exportResponse = await request.get("/api/reports/export?type=stock");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-type"]).toContain("text/csv");
  expect(await exportResponse.text()).toContain('"Toko"');

  // A second account is restricted to one store with view-only access.
  const staff = await apiRequest.newContext({ baseURL: origin });
  const staffEmail = await signUp(staff, "Karyawan Backend");
  const users = (await (await request.get("/api/users")).json()).data as {
    id: string;
    email: string;
  }[];
  const staffRow = users.find((row) => row.email === staffEmail)!;

  const setAccess = await request.put(`/api/users/${staffRow.id}/access`, {
    headers,
    data: { access: [{ storeId, accessLevel: "view" }] },
  });
  expect(setAccess.status()).toBe(200);
  expect((await setAccess.json()).data.role).toBe("staff");

  const staffStores = (await (await staff.get("/api/stores")).json()).data;
  expect(staffStores).toHaveLength(1);
  expect(staffStores[0].id).toBe(storeId);

  const staffWrite = await staff.post("/api/products", {
    headers,
    data: { storeId, name: "Ditolak", unit: "pcs" },
  });
  expect(staffWrite.status()).toBe(403);
  expect((await staffWrite.json()).error.code).toBe("FORBIDDEN");

  const staffManage = await staff.put(`/api/users/${staffRow.id}/access`, {
    headers,
    data: { access: [] },
  });
  expect(staffManage.status()).toBe(403);

  await staff.dispose();
});
