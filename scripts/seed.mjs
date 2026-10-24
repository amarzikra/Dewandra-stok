// Idempotent demo data: npm run seed
// Adds login accounts, catalog items, stock history, one return, and one opname
// to the local database. Existing rows are kept; running it twice is safe.
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { loadEnvironment } from "./lib.mjs";
import { databaseError, databaseUrl } from "./postgres.mjs";

const ACCOUNTS = [
  {
    key: "owner",
    name: "Dewandra Pemilik",
    email: "pemilik@dewandra.test",
    password: "DewandraOwner123!",
    role: "owner",
  },
  {
    key: "staff",
    name: "Rina Staf",
    email: "staf@dewandra.test",
    password: "DewandraStaff123!",
    role: "staff",
  },
];

const STORES = [
  {
    code: "PPK",
    name: "Toko Pupuk",
    address: "Jl. Raya Sawah No. 12, Sleman",
    phone: "0274-555-0101",
  },
  {
    code: "BGN",
    name: "Toko Bangunan",
    address: "Jl. Kaliurang KM 8 No. 45, Sleman",
    phone: "0274-555-0102",
  },
  {
    code: "ATK",
    name: "Toko ATK",
    address: "Jl. Malioboro No. 88, Yogyakarta",
    phone: "0274-555-0103",
  },
  {
    code: "LSK",
    name: "Toko Listrik",
    address: "Jl. Gejayan No. 21, Yogyakarta",
    phone: "0274-555-0104",
  },
  {
    code: "FRN",
    name: "Toko Furniture",
    address: "Jl. Ringroad Utara No. 7, Sleman",
    phone: "0274-555-0105",
  },
];

// incoming and outgoing become real stock movements. Final stock is the
// difference, so dashboard counts, reports, and history always agree.
const PRODUCTS = [
  {
    store: "PPK",
    name: "Pupuk Urea 50 kg",
    sku: "PPK-001",
    category: "Pupuk",
    unit: "sak",
    price: 320_000,
    minStock: 10,
    incoming: [45, 20],
    outgoing: [30, 8],
  },
  {
    store: "PPK",
    name: "Pupuk NPK Phonska 50 kg",
    sku: "PPK-002",
    category: "Pupuk",
    unit: "sak",
    price: 350_000,
    minStock: 8,
    incoming: [30, 15],
    outgoing: [20, 12],
  },
  {
    store: "PPK",
    name: "Pupuk Organik Granul 20 kg",
    sku: "PPK-003",
    category: "Pupuk",
    unit: "sak",
    price: 120_000,
    minStock: 12,
    incoming: [25, 10],
    outgoing: [15, 9],
  },
  {
    store: "PPK",
    name: "Bibit Jagung Hibrida 1 kg",
    sku: "PPK-004",
    category: "Benih",
    unit: "kg",
    price: 85_000,
    minStock: 20,
    incoming: [30, 15],
    outgoing: [20, 10],
  },
  {
    store: "BGN",
    name: "Semen Portland 50 kg",
    sku: "BGN-001",
    category: "Semen",
    unit: "sak",
    price: 72_000,
    minStock: 20,
    incoming: [80, 40],
    outgoing: [75, 30],
  },
  {
    store: "BGN",
    name: "Pasir Beton",
    sku: "BGN-002",
    category: "Material",
    unit: "m3",
    price: 350_000,
    minStock: 5,
    incoming: [12, 6],
    outgoing: [5, 4],
  },
  {
    store: "BGN",
    name: "Bata Merah",
    sku: "BGN-003",
    category: "Material",
    unit: "pcs",
    price: 950,
    minStock: 500,
    incoming: [2000, 1000],
    outgoing: [1200, 800],
  },
  {
    store: "BGN",
    name: "Cat Tembok 5 kg",
    sku: "BGN-004",
    category: "Cat",
    unit: "kaleng",
    price: 155_000,
    minStock: 12,
    incoming: [30, 10],
    outgoing: [18, 10],
  },
  {
    store: "ATK",
    name: "Kertas HVS A4 80 g",
    sku: "ATK-001",
    category: "Kertas",
    unit: "rim",
    price: 55_000,
    minStock: 10,
    incoming: [50, 20],
    outgoing: [25, 15],
  },
  {
    store: "ATK",
    name: "Pulpen Hitam 0.5 mm",
    sku: "ATK-002",
    category: "Alat Tulis",
    unit: "pcs",
    price: 3_500,
    minStock: 50,
    incoming: [200, 100],
    outgoing: [120, 60],
  },
  {
    store: "ATK",
    name: "Map Plastik F4",
    sku: "ATK-003",
    category: "Perlengkapan",
    unit: "pcs",
    price: 2_500,
    minStock: 40,
    incoming: [100, 50],
    outgoing: [55, 40],
  },
  {
    store: "ATK",
    name: "Tinta Printer Hitam",
    sku: "ATK-004",
    category: "Tinta",
    unit: "botol",
    price: 95_000,
    minStock: 6,
    incoming: [12, 6],
    outgoing: [8, 6],
  },
  {
    store: "LSK",
    name: "Lampu LED 12 W",
    sku: "LSK-001",
    category: "Lampu",
    unit: "pcs",
    price: 35_000,
    minStock: 20,
    incoming: [60, 30],
    outgoing: [35, 20],
  },
  {
    store: "LSK",
    name: "Kabel NYM 2x1.5 mm 50 m",
    sku: "LSK-002",
    category: "Kabel",
    unit: "roll",
    price: 425_000,
    minStock: 5,
    incoming: [10, 5],
    outgoing: [6, 3],
  },
  {
    store: "LSK",
    name: "Saklar Tunggal",
    sku: "LSK-003",
    category: "Saklar",
    unit: "pcs",
    price: 18_000,
    minStock: 30,
    incoming: [80, 40],
    outgoing: [45, 30],
  },
  {
    store: "LSK",
    name: "Stop Kontak 4 Lubang",
    sku: "LSK-004",
    category: "Stop Kontak",
    unit: "pcs",
    price: 55_000,
    minStock: 10,
    incoming: [25, 10],
    outgoing: [15, 12],
  },
  {
    store: "FRN",
    name: "Kursi Makan Kayu Jati",
    sku: "FRN-001",
    category: "Kursi",
    unit: "pcs",
    price: 650_000,
    minStock: 4,
    incoming: [12, 6],
    outgoing: [6, 3],
  },
  {
    store: "FRN",
    name: "Meja Kerja 120 cm",
    sku: "FRN-002",
    category: "Meja",
    unit: "pcs",
    price: 1_250_000,
    minStock: 3,
    incoming: [8, 4],
    outgoing: [5, 3],
  },
  {
    store: "FRN",
    name: "Lemari Pakaian 2 Pintu",
    sku: "FRN-003",
    category: "Lemari",
    unit: "pcs",
    price: 1_850_000,
    minStock: 2,
    incoming: [6, 2],
    outgoing: [4, 2],
  },
  {
    store: "FRN",
    name: "Rak Buku 3 Tingkat",
    sku: "FRN-004",
    category: "Rak",
    unit: "pcs",
    price: 750_000,
    minStock: 3,
    incoming: [10, 5],
    outgoing: [6, 4],
  },
];

const RETURNS = [
  {
    store: "ATK",
    sku: "ATK-001",
    type: "from_customer",
    quantity: 2,
    reason: "Demo seed: retur dari pelanggan",
    daysAgo: 0,
  },
  {
    store: "BGN",
    sku: "BGN-001",
    type: "to_supplier",
    quantity: 3,
    reason: "Demo seed: retur ke pemasok",
    daysAgo: 1,
  },
];

const OPNAME = {
  store: "LSK",
  note: "Demo seed: stock opname",
  daysAgo: 3,
  items: [
    { sku: "LSK-001", difference: -5 },
    { sku: "LSK-003", difference: 2 },
  ],
};

function dateAt(daysAgo, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function calendarDate(daysAgo) {
  const date = dateAt(daysAgo);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function upsertAccount(client, account) {
  const passwordHash = await hashPassword(account.password);
  const { rows } = await client.query(
    `INSERT INTO "user" (id, name, email, email_verified, role, created_at, updated_at)
     VALUES ($1, $2, $3, true, $4, now(), now())
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, role = EXCLUDED.role, updated_at = now()
     RETURNING id`,
    [randomUUID(), account.name, account.email, account.role],
  );
  const userId = rows[0].id;
  const existing = await client.query(
    `SELECT id FROM account
     WHERE user_id = $1 AND provider_id = 'credential'
     ORDER BY created_at LIMIT 1`,
    [userId],
  );
  if (existing.rows.length) {
    await client.query(
      `UPDATE account SET password = $1, updated_at = now() WHERE id = $2`,
      [passwordHash, existing.rows[0].id],
    );
  } else {
    await client.query(
      `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
       VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomUUID(), userId, passwordHash],
    );
  }
  return userId;
}

async function ensureStores(client) {
  const ids = new Map();
  for (const store of STORES) {
    const { rows } = await client.query(
      `INSERT INTO stores (name, code, address, phone, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (code) DO UPDATE
         SET address = COALESCE(stores.address, EXCLUDED.address),
             phone = COALESCE(stores.phone, EXCLUDED.phone)
       RETURNING id, code`,
      [store.name, store.code, store.address, store.phone],
    );
    ids.set(rows[0].code, rows[0].id);
  }
  return ids;
}

async function ensureProducts(client, storeIds) {
  const products = [];
  for (const product of PRODUCTS) {
    const storeId = storeIds.get(product.store);
    if (!storeId) continue;
    const { rows } = await client.query(
      `INSERT INTO products
         (store_id, name, sku, category, unit, price, min_stock, current_stock, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, true)
       ON CONFLICT (store_id, sku) DO NOTHING
       RETURNING id`,
      [
        storeId,
        product.name,
        product.sku,
        product.category,
        product.unit,
        product.price,
        product.minStock,
      ],
    );
    const id =
      rows[0]?.id ??
      (
        await client.query(
          `SELECT id FROM products WHERE store_id = $1 AND sku = $2 LIMIT 1`,
          [storeId, product.sku],
        )
      ).rows[0]?.id;
    if (id) products.push({ ...product, id, storeId });
  }
  return products;
}

async function seedMovements(client, products, ownerId) {
  let inserted = 0;
  for (const product of products) {
    const existing = await client.query(
      `SELECT 1 FROM stock_movements WHERE product_id = $1 LIMIT 1`,
      [product.id],
    );
    if (existing.rows.length) continue;

    const [firstIn, secondIn] = product.incoming;
    const [lastWeekOut, todayOut] = product.outgoing;
    const movements = [
      {
        type: "in",
        quantity: firstIn,
        daysAgo: 6,
        hour: 8,
        note: "Stok awal (seed)",
      },
      {
        type: "in",
        quantity: secondIn,
        daysAgo: 4,
        hour: 10,
        note: "Pembelian dari pemasok (seed)",
      },
      {
        type: "out",
        quantity: lastWeekOut,
        daysAgo: 2,
        hour: 14,
        note: "Penjualan beberapa hari lalu (seed)",
      },
      {
        type: "out",
        quantity: todayOut,
        daysAgo: 0,
        hour: 11,
        note: "Penjualan hari ini (seed)",
      },
    ];

    for (const movement of movements) {
      await client.query(
        `INSERT INTO stock_movements
           (product_id, store_id, type, quantity, movement_date, note, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          product.id,
          product.storeId,
          movement.type,
          movement.quantity,
          calendarDate(movement.daysAgo),
          movement.note,
          ownerId,
          dateAt(movement.daysAgo, movement.hour),
        ],
      );
    }

    const finalStock = firstIn + secondIn - lastWeekOut - todayOut;
    await client.query(
      `UPDATE products SET current_stock = $1, updated_at = now() WHERE id = $2`,
      [finalStock, product.id],
    );
    inserted += 1;
  }
  return inserted;
}

async function seedReturns(client, products, ownerId) {
  let inserted = 0;
  for (const entry of RETURNS) {
    const existing = await client.query(
      `SELECT 1 FROM returns WHERE reason = $1 LIMIT 1`,
      [entry.reason],
    );
    if (existing.rows.length) continue;

    const product = products.find(
      (row) => row.store === entry.store && row.sku === entry.sku,
    );
    if (!product) continue;

    const { rows } = await client.query(
      `SELECT current_stock FROM products WHERE id = $1 FOR UPDATE`,
      [product.id],
    );
    const currentStock = Number(rows[0]?.current_stock ?? 0);
    if (entry.type === "to_supplier" && currentStock < entry.quantity) {
      console.warn(
        `Lewati retur ${entry.sku}: stok ${currentStock} kurang dari ${entry.quantity}.`,
      );
      continue;
    }

    const returnDate = calendarDate(entry.daysAgo);
    const createdAt = dateAt(entry.daysAgo, 15);
    const { rows: returned } = await client.query(
      `INSERT INTO returns
         (product_id, store_id, type, quantity, reason, return_date, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        product.id,
        product.storeId,
        entry.type,
        entry.quantity,
        entry.reason,
        returnDate,
        ownerId,
        createdAt,
      ],
    );

    const delta =
      entry.type === "to_supplier" ? -entry.quantity : entry.quantity;
    await client.query(
      `INSERT INTO stock_movements
         (product_id, store_id, type, quantity, movement_date, note, reference_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        product.id,
        product.storeId,
        entry.type === "to_supplier" ? "return_out" : "return_in",
        entry.quantity,
        returnDate,
        entry.reason,
        returned[0].id,
        ownerId,
        createdAt,
      ],
    );
    await client.query(
      `UPDATE products SET current_stock = current_stock + $1, updated_at = now() WHERE id = $2`,
      [delta, product.id],
    );
    inserted += 1;
  }
  return inserted;
}

async function seedOpname(client, products, storeIds, ownerId) {
  const existing = await client.query(
    `SELECT 1 FROM stock_opnames WHERE note = $1 LIMIT 1`,
    [OPNAME.note],
  );
  if (existing.rows.length) return false;

  const storeId = storeIds.get(OPNAME.store);
  if (!storeId) return false;

  const rows = [];
  for (const item of OPNAME.items) {
    const product = products.find(
      (row) => row.store === OPNAME.store && row.sku === item.sku,
    );
    if (!product) continue;
    const { rows: current } = await client.query(
      `SELECT current_stock, name, unit FROM products WHERE id = $1 FOR UPDATE`,
      [product.id],
    );
    const systemQty = Number(current[0].current_stock);
    const physicalQty = Math.max(0, systemQty + item.difference);
    rows.push({
      id: product.id,
      systemQty,
      physicalQty,
      difference: Math.round((physicalQty - systemQty) * 100) / 100,
    });
  }
  if (rows.length === 0) return false;

  const opnameDate = calendarDate(OPNAME.daysAgo);
  const createdAt = dateAt(OPNAME.daysAgo, 16);
  const { rows: sessions } = await client.query(
    `INSERT INTO stock_opnames
       (store_id, opname_date, status, note, created_by, created_at)
     VALUES ($1, $2, 'selesai', $3, $4, $5)
     RETURNING id`,
    [storeId, opnameDate, OPNAME.note, ownerId, createdAt],
  );
  const opnameId = sessions[0].id;

  for (const row of rows) {
    await client.query(
      `INSERT INTO stock_opname_items
         (opname_id, product_id, system_qty, physical_qty, difference, is_adjusted)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        opnameId,
        row.id,
        row.systemQty,
        row.physicalQty,
        row.difference,
        row.difference !== 0,
      ],
    );
    if (row.difference === 0) continue;
    await client.query(
      `INSERT INTO stock_movements
         (product_id, store_id, type, quantity, movement_date, note, reference_id, created_by, created_at)
       VALUES ($1, $2, 'adjustment', $3, $4, $5, $6, $7, $8)`,
      [
        row.id,
        storeId,
        row.difference,
        opnameDate,
        OPNAME.note,
        opnameId,
        ownerId,
        createdAt,
      ],
    );
    await client.query(
      `UPDATE products SET current_stock = $1, updated_at = now() WHERE id = $2`,
      [row.physicalQty, row.id],
    );
  }
  return true;
}

async function seedStaffAccess(client, staffId, storeIds) {
  const grants = [
    { code: "ATK", level: "edit" },
    { code: "PPK", level: "view" },
  ];
  await client.query(`DELETE FROM user_stores WHERE user_id = $1`, [staffId]);
  for (const grant of grants) {
    const storeId = storeIds.get(grant.code);
    if (!storeId) continue;
    await client.query(
      `INSERT INTO user_stores (user_id, store_id, access_level)
       VALUES ($1, $2, $3)`,
      [staffId, storeId, grant.level],
    );
  }
  return grants;
}

async function counts(client) {
  const queries = {
    stores: "SELECT count(*)::int AS n FROM stores",
    products: "SELECT count(*)::int AS n FROM products WHERE is_active = true",
    movements: "SELECT count(*)::int AS n FROM stock_movements",
    returns: "SELECT count(*)::int AS n FROM returns",
    opnames: "SELECT count(*)::int AS n FROM stock_opnames",
    accounts: 'SELECT count(*)::int AS n FROM "user"',
  };
  const result = {};
  for (const [key, sql] of Object.entries(queries)) {
    result[key] = (await client.query(sql)).rows[0].n;
  }
  return result;
}

await loadEnvironment();
const pool = new Pool({
  connectionString: databaseUrl(),
  max: 1,
  connectionTimeoutMillis: 5000,
});
pool.on("error", () => {});

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const accountIds = {};
    for (const account of ACCOUNTS) {
      accountIds[account.key] = await upsertAccount(client, account);
    }
    const storeIds = await ensureStores(client);
    const products = await ensureProducts(client, storeIds);
    const movementCount = await seedMovements(
      client,
      products,
      accountIds.owner,
    );
    const returnCount = await seedReturns(client, products, accountIds.owner);
    const opnameCreated = await seedOpname(
      client,
      products,
      storeIds,
      accountIds.owner,
    );
    const grants = await seedStaffAccess(client, accountIds.staff, storeIds);
    const totals = await counts(client);
    await client.query("COMMIT");

    console.log("Seed Dewandra Stok selesai.");
    console.log("");
    console.log("Akun login:");
    for (const account of ACCOUNTS) {
      console.log(
        `  ${account.role.padEnd(5)}  ${account.email}  /  ${account.password}`,
      );
    }
    console.log(
      `  Staf dibatasi ke: ${grants.map((grant) => `${grant.code} (${grant.level})`).join(", ")}`,
    );
    console.log("");
    console.log(
      `Data: ${totals.stores} toko, ${totals.products} barang aktif, ` +
        `${totals.movements} pergerakan stok, ${totals.returns} retur, ` +
        `${totals.opnames} opname, ${totals.accounts} akun.`,
    );
    console.log(
      movementCount > 0 || returnCount > 0 || opnameCreated
        ? `Baru ditambahkan: ${movementCount} barang berisi stok, ${returnCount} retur, ${opnameCreated ? 1 : 0} opname.`
        : "Data demo sudah ada; tidak ada duplikat yang dibuat.",
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(databaseError(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
