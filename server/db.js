import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/ml_store";
export const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
});

export function now() {
  return new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function publicUser(user) {
  const { passwordHash, password_hash, ...safeUser } = user;
  return safeUser;
}

function defaultSeedStore() {
  const adminHash = bcrypt.hashSync("admin123", 10);
  const customerHash = bcrypt.hashSync("customer123", 10);
  return {
    customerTiers: [
      { id: "tier-a", code: "A", name: "A 客戶", description: "Default customer tier", isActive: true },
      { id: "tier-hotel", code: "Hotel", name: "飯店通路", description: "Hotel and hospitality customers", isActive: true },
      { id: "tier-oem", code: "OEM", name: "OEM 客戶", description: "OEM and private-label customers", isActive: true },
    ],
    users: [
      { id: "admin-1", loginId: "admin", name: "工廠管理員", email: "admin@example.com", role: "admin", allowedPaymentMethods: [], isActive: true, passwordHash: adminHash },
      { id: "cust-1", loginId: "hotel", name: "沐森旅店", email: "hotel@example.com", role: "customer", customerTierId: "tier-hotel", allowedPaymentMethods: ["credit_card"], isActive: true, taxId: "24567890", companyName: "沐森旅店股份有限公司", contactName: "王小姐", shippingAddress: "台北市信義區松仁路 100 號", shippingDetail: "1 樓收貨區，週一至週五 10:00-17:00 可收貨", passwordHash: customerHash },
      { id: "cust-2", loginId: "salon", name: "青禾沙龍", email: "salon@example.com", role: "customer", customerTierId: "tier-a", allowedPaymentMethods: ["credit_card"], isActive: true, taxId: "87654321", companyName: "青禾沙龍有限公司", contactName: "林先生", shippingAddress: "台中市西屯區市政北二路 88 號", shippingDetail: "請送至 3 樓櫃台", passwordHash: customerHash },
    ],
    products: [
      { id: "p1", sku: "SH-001-300", name: "柔順洗髮精 300ml", brand: "ML Lab", series: "", category: "洗沐", description: "適合飯店備品與日常零售的溫和洗髮精。", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80", salesUnit: "瓶", packSize: "24 瓶/箱", moq: 24, orderIncrement: 24, stockQuantity: 0, isOrderable: true, isActive: true },
      { id: "p2", sku: "SH-001-4000", name: "柔順洗髮精 4000ml", brand: "ML Lab", series: "", category: "洗沐", description: "大容量補充桶，適合飯店與沙龍後場使用。", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80", salesUnit: "桶", packSize: "4 桶/箱", moq: 4, orderIncrement: 4, stockQuantity: 0, isOrderable: true, isActive: true },
      { id: "p3", sku: "OEM-FACE-001", name: "OEM 溫和潔面乳", brand: "Private Label", series: "", category: "臉部保養", description: "可供品牌客戶進行配方與包裝客製。", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=80", salesUnit: "瓶", packSize: "120 瓶/箱", moq: 120, orderIncrement: 120, stockQuantity: 0, isOrderable: false, isActive: true },
      { id: "p4", sku: "BD-002-500", name: "草本沐浴乳 500ml", brand: "Aroma Pro", series: "", category: "洗沐", description: "清爽草本香氣，適合通路與團購銷售。", image: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=900&q=80", salesUnit: "瓶", packSize: "12 瓶/箱", moq: 12, orderIncrement: 12, stockQuantity: 0, isOrderable: false, isActive: true },
    ],
    prices: [
      { id: "pr1", productId: "p1", scopeType: "default", scopeId: null, price: 180, currency: "TWD", isActive: true },
      { id: "pr2", productId: "p1", scopeType: "customer_tier", scopeId: "tier-hotel", price: 145, currency: "TWD", isActive: true },
      { id: "pr3", productId: "p2", scopeType: "default", scopeId: null, price: 980, currency: "TWD", isActive: true },
      { id: "pr4", productId: "p2", scopeType: "customer", scopeId: "cust-1", price: 860, currency: "TWD", isActive: true },
      { id: "pr5", productId: "p4", scopeType: "default", scopeId: null, price: 260, currency: "TWD", isActive: true },
    ],
    visibilityRules: [
      { id: "vr1", productId: "p1", ruleType: "visible_to_all", scopeId: null, isActive: true },
      { id: "vr2", productId: "p2", ruleType: "visible_to_customer_tier", scopeId: "tier-hotel", isActive: true },
      { id: "vr3", productId: "p3", ruleType: "visible_to_customer_tier", scopeId: "tier-oem", isActive: true },
      { id: "vr4", productId: "p3", ruleType: "visible_to_customer", scopeId: "cust-1", isActive: true },
      { id: "vr5", productId: "p4", ruleType: "visible_to_all", scopeId: null, isActive: true },
      { id: "vr6", productId: "p4", ruleType: "hidden_from_customer", scopeId: "cust-2", isActive: true },
    ],
    orders: [],
  };
}

function jsonStorePath() {
  return path.resolve("data", "store.json");
}

function seedSourceStore() {
  const filePath = jsonStorePath();
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  return defaultSeedStore();
}

function mapUserRow(row) {
  return {
    id: row.id,
    loginId: row.login_id,
    name: row.name,
    email: row.email,
    role: row.role,
    customerTierId: row.customer_tier_id ?? undefined,
    allowedPaymentMethods: row.allowed_payment_methods ?? [],
    taxId: row.tax_id ?? "",
    companyName: row.company_name ?? "",
    contactName: row.contact_name ?? "",
    shippingAddress: row.shipping_address ?? "",
    shippingDetail: row.shipping_detail ?? "",
    isActive: row.is_active,
    passwordHash: row.password_hash,
  };
}

function mapTierRow(row) {
  return { id: row.id, code: row.code, name: row.name, description: row.description ?? "", isActive: row.is_active };
}

function mapProductRow(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    series: row.series,
    category: row.category,
    description: row.description,
    image: row.image,
    salesUnit: row.sales_unit,
    packSize: row.pack_size,
    moq: Number(row.moq),
    orderIncrement: Number(row.order_increment),
    stockQuantity: Number(row.stock_quantity ?? 0),
    isOrderable: row.is_orderable,
    isActive: row.is_active,
  };
}

function mapPriceRow(row) {
  return { id: row.id, productId: row.product_id, scopeType: row.scope_type, scopeId: row.scope_id, price: Number(row.price), currency: row.currency, isActive: row.is_active };
}

function mapRuleRow(row) {
  return { id: row.id, productId: row.product_id, ruleType: row.rule_type, scopeId: row.scope_id, isActive: row.is_active };
}

function mapItemRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    skuSnapshot: row.sku_snapshot,
    productNameSnapshot: row.product_name_snapshot,
    brandSnapshot: row.brand_snapshot,
    salesUnitSnapshot: row.sales_unit_snapshot,
    packSizeSnapshot: row.pack_size_snapshot,
    unitPriceSnapshot: Number(row.unit_price_snapshot),
    quantity: Number(row.quantity),
    subtotal: Number(row.subtotal),
  };
}

function mapRevisionRow(row) {
  return {
    id: row.id,
    revisedBy: row.revised_by,
    previousTotal: Number(row.previous_total),
    newTotal: Number(row.new_total),
    changeSummary: row.change_summary,
    beforeSnapshot: row.before_snapshot ?? [],
    afterSnapshot: row.after_snapshot ?? [],
    customerAcceptanceRequired: row.customer_acceptance_required,
    customerAcceptedAt: row.customer_accepted_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapPaymentRow(row) {
  return {
    id: row.id,
    method: row.method,
    provider: row.provider,
    amount: Number(row.amount),
    status: row.status,
    paidAt: row.paid_at ?? undefined,
  };
}

function mapOrderRow(row, items, revisions, paymentRecords) {
  return {
    id: row.id,
    orderNo: row.order_no,
    customerId: row.customer_id,
    customerSnapshot: row.customer_snapshot ?? undefined,
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
    selectedPaymentMethod: row.selected_payment_method,
    items,
    subtotal: Number(row.subtotal),
    adjustmentTotal: Number(row.adjustment_total),
    freightTotal: Number(row.freight_total),
    grandTotal: Number(row.grand_total),
    customerNote: row.customer_note ?? "",
    adminNote: row.admin_note ?? "",
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at ?? undefined,
    revisions,
    paymentRecords,
  };
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_tiers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      login_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
      customer_tier_id TEXT REFERENCES customer_tiers(id),
      allowed_payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
      tax_id TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      shipping_address TEXT NOT NULL DEFAULT '',
      shipping_detail TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      series TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      sales_unit TEXT NOT NULL DEFAULT '件',
      pack_size TEXT NOT NULL DEFAULT '',
      moq INTEGER NOT NULL DEFAULT 1,
      order_increment INTEGER NOT NULL DEFAULT 1,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      is_orderable BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS product_prices (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('default', 'customer_tier', 'customer')),
      scope_id TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'TWD',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (product_id, scope_type, scope_id)
    );

    CREATE TABLE IF NOT EXISTS visibility_rules (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rule_type TEXT NOT NULL CHECK (rule_type IN ('visible_to_all', 'visible_to_customer_tier', 'visible_to_customer', 'hidden_from_customer')),
      scope_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (product_id, rule_type, scope_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES app_users(id),
      customer_snapshot JSONB,
      order_status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      selected_payment_method TEXT NOT NULL,
      subtotal INTEGER NOT NULL DEFAULT 0,
      adjustment_total INTEGER NOT NULL DEFAULT 0,
      freight_total INTEGER NOT NULL DEFAULT 0,
      grand_total INTEGER NOT NULL DEFAULT 0,
      customer_note TEXT NOT NULL DEFAULT '',
      admin_note TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL,
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      sku_snapshot TEXT NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      brand_snapshot TEXT NOT NULL,
      sales_unit_snapshot TEXT NOT NULL,
      pack_size_snapshot TEXT NOT NULL,
      unit_price_snapshot INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_revisions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      revised_by TEXT NOT NULL,
      previous_total INTEGER NOT NULL,
      new_total INTEGER NOT NULL,
      change_summary TEXT NOT NULL,
      before_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
      after_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
      customer_acceptance_required BOOLEAN NOT NULL DEFAULT FALSE,
      customer_accepted_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      provider TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      paid_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_revisions_order_id ON order_revisions(order_id);
    CREATE INDEX IF NOT EXISTS idx_payment_records_order_id ON payment_records(order_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_unique_scope ON product_prices (product_id, scope_type, COALESCE(scope_id, '__null__'));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_visibility_rules_unique_scope ON visibility_rules (product_id, rule_type, COALESCE(scope_id, '__null__'));
    CREATE SEQUENCE IF NOT EXISTS b2b_order_no_seq START 1;
  `);
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0");

  const existing = await pool.query("SELECT COUNT(*)::int AS count FROM app_users");
  if (existing.rows[0].count === 0) {
    await seedDatabase(seedSourceStore());
  }
  await syncOrderSequence();
}

async function syncOrderSequence() {
  const result = await pool.query("SELECT COALESCE(MAX(substring(order_no from 'B2B-([0-9]+)')::int), 0) AS max_order_no FROM orders");
  const maxOrderNo = Number(result.rows[0].max_order_no) || 0;
  await pool.query("SELECT setval('b2b_order_no_seq', $1, $2)", [Math.max(maxOrderNo, 1), maxOrderNo > 0]);
}

export async function nextOrderNo() {
  const result = await pool.query("SELECT nextval('b2b_order_no_seq')::int AS value");
  return `B2B-${String(result.rows[0].value).padStart(5, "0")}`;
}

export async function seedDatabase(store) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const tier of store.customerTiers ?? []) await upsertTier(tier, client);
    for (const user of store.users ?? []) await upsertUser({ ...user, passwordHash: user.passwordHash ?? bcrypt.hashSync(user.password ?? "changeme123", 10) }, client);
    for (const product of store.products ?? []) await upsertProduct(product, client);
    for (const price of store.prices ?? []) await upsertPrice(price, client);
    for (const rule of store.visibilityRules ?? []) await upsertVisibilityRule(rule, client);
    for (const order of store.orders ?? []) await insertOrder(order, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function readStore() {
  const [tiers, users, products, prices, rules, orders] = await Promise.all([
    pool.query("SELECT * FROM customer_tiers ORDER BY code"),
    pool.query("SELECT * FROM app_users ORDER BY role, login_id"),
    pool.query("SELECT * FROM products ORDER BY sku"),
    pool.query("SELECT * FROM product_prices ORDER BY product_id, scope_type, scope_id NULLS FIRST"),
    pool.query("SELECT * FROM visibility_rules ORDER BY product_id, rule_type, scope_id NULLS FIRST"),
    pool.query("SELECT * FROM orders ORDER BY submitted_at DESC, order_no DESC"),
  ]);

  const orderIds = orders.rows.map((order) => order.id);
  const [items, revisions, payments] = orderIds.length > 0
    ? await Promise.all([
      pool.query("SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY order_id, id", [orderIds]),
      pool.query("SELECT * FROM order_revisions WHERE order_id = ANY($1) ORDER BY order_id, created_at DESC", [orderIds]),
      pool.query("SELECT * FROM payment_records WHERE order_id = ANY($1) ORDER BY order_id, paid_at NULLS LAST, id", [orderIds]),
    ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }];

  return {
    customerTiers: tiers.rows.map(mapTierRow),
    users: users.rows.map(mapUserRow),
    products: products.rows.map(mapProductRow),
    prices: prices.rows.map(mapPriceRow),
    visibilityRules: rules.rows.map(mapRuleRow),
    orders: orders.rows.map((order) => mapOrderRow(
      order,
      items.rows.filter((item) => item.order_id === order.id).map(mapItemRow),
      revisions.rows.filter((revision) => revision.order_id === order.id).map(mapRevisionRow),
      payments.rows.filter((payment) => payment.order_id === order.id).map(mapPaymentRow),
    )),
  };
}

export async function findActiveUserById(id) {
  const result = await pool.query("SELECT * FROM app_users WHERE id = $1 AND is_active = TRUE", [id]);
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function findActiveUserByLoginId(loginId) {
  const result = await pool.query("SELECT * FROM app_users WHERE LOWER(login_id) = LOWER($1) AND is_active = TRUE", [loginId]);
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function upsertTier(tier, client = pool) {
  const saved = {
    id: tier.id || makeId("tier"),
    code: String(tier.code ?? "").trim(),
    name: String(tier.name ?? "").trim(),
    description: tier.description ?? "",
    isActive: Boolean(tier.isActive),
  };
  await client.query(`
    INSERT INTO customer_tiers (id, code, name, description, is_active)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active
  `, [saved.id, saved.code, saved.name, saved.description, saved.isActive]);
  return saved;
}

export async function upsertUser(user, client = pool) {
  const existing = user.id ? await client.query("SELECT password_hash FROM app_users WHERE id = $1", [user.id]) : { rows: [] };
  const saved = {
    id: user.id || makeId("user"),
    loginId: String(user.loginId ?? "").trim(),
    name: String(user.name ?? "").trim(),
    email: user.email ?? "",
    role: user.role,
    customerTierId: user.role === "customer" ? user.customerTierId ?? null : null,
    allowedPaymentMethods: user.role === "customer" ? user.allowedPaymentMethods ?? [] : [],
    taxId: user.role === "customer" ? user.taxId ?? "" : "",
    companyName: user.role === "customer" ? user.companyName ?? user.name ?? "" : "",
    contactName: user.role === "customer" ? user.contactName ?? "" : "",
    shippingAddress: user.role === "customer" ? user.shippingAddress ?? "" : "",
    shippingDetail: user.role === "customer" ? user.shippingDetail ?? "" : "",
    isActive: Boolean(user.isActive),
    passwordHash: user.password ? bcrypt.hashSync(user.password, 10) : user.passwordHash ?? existing.rows[0]?.password_hash ?? bcrypt.hashSync("changeme123", 10),
  };
  await client.query(`
    INSERT INTO app_users (id, login_id, name, email, role, customer_tier_id, allowed_payment_methods, tax_id, company_name, contact_name, shipping_address, shipping_detail, is_active, password_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (id) DO UPDATE SET
      login_id = EXCLUDED.login_id,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      customer_tier_id = EXCLUDED.customer_tier_id,
      allowed_payment_methods = EXCLUDED.allowed_payment_methods,
      tax_id = EXCLUDED.tax_id,
      company_name = EXCLUDED.company_name,
      contact_name = EXCLUDED.contact_name,
      shipping_address = EXCLUDED.shipping_address,
      shipping_detail = EXCLUDED.shipping_detail,
      is_active = EXCLUDED.is_active,
      password_hash = EXCLUDED.password_hash
  `, [saved.id, saved.loginId, saved.name, saved.email, saved.role, saved.customerTierId, JSON.stringify(saved.allowedPaymentMethods), saved.taxId, saved.companyName, saved.contactName, saved.shippingAddress, saved.shippingDetail, saved.isActive, saved.passwordHash]);
  return saved;
}

export async function upsertProduct(product, client = pool) {
  const sku = String(product.sku ?? "").trim();
  const existing = product.id
    ? await client.query("SELECT id FROM products WHERE id = $1", [product.id])
    : await client.query("SELECT id FROM products WHERE LOWER(sku) = LOWER($1)", [sku]);
  const saved = {
    id: existing.rows[0]?.id || product.id || makeId("product"),
    sku,
    name: String(product.name ?? "").trim(),
    brand: String(product.brand ?? "").trim(),
    series: "",
    category: String(product.category ?? "").trim(),
    description: String(product.description ?? "").trim(),
    image: String(product.image ?? "").trim(),
    salesUnit: String(product.salesUnit ?? "").trim() || "件",
    packSize: String(product.packSize ?? "").trim(),
    moq: Math.max(1, Number(product.moq) || 1),
    orderIncrement: Math.max(1, Number(product.orderIncrement) || 1),
    stockQuantity: Math.max(0, Number(product.stockQuantity) || 0),
    isOrderable: Boolean(product.isOrderable),
    isActive: Boolean(product.isActive),
  };
  await client.query(`
    INSERT INTO products (id, sku, name, brand, series, category, description, image, sales_unit, pack_size, moq, order_increment, stock_quantity, is_orderable, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO UPDATE SET sku = EXCLUDED.sku, name = EXCLUDED.name, brand = EXCLUDED.brand, series = EXCLUDED.series, category = EXCLUDED.category, description = EXCLUDED.description, image = EXCLUDED.image, sales_unit = EXCLUDED.sales_unit, pack_size = EXCLUDED.pack_size, moq = EXCLUDED.moq, order_increment = EXCLUDED.order_increment, stock_quantity = EXCLUDED.stock_quantity, is_orderable = EXCLUDED.is_orderable, is_active = EXCLUDED.is_active
  `, [saved.id, saved.sku, saved.name, saved.brand, saved.series, saved.category, saved.description, saved.image, saved.salesUnit, saved.packSize, saved.moq, saved.orderIncrement, saved.stockQuantity, saved.isOrderable, saved.isActive]);
  return saved;
}

export async function patchProduct(id, patch) {
  const current = (await readStore()).products.find((product) => product.id === id);
  if (!current) return null;
  return upsertProduct({ ...current, ...patch, id });
}

export async function upsertPrice(price, client = pool) {
  const scopeId = price.scopeType === "default" ? null : price.scopeId;
  const existing = price.id
    ? await client.query("SELECT id FROM product_prices WHERE id = $1", [price.id])
    : await client.query("SELECT id FROM product_prices WHERE product_id = $1 AND scope_type = $2 AND scope_id IS NOT DISTINCT FROM $3", [price.productId, price.scopeType, scopeId]);
  const saved = {
    id: existing.rows[0]?.id || price.id || makeId("price"),
    productId: price.productId,
    scopeType: price.scopeType,
    scopeId,
    price: Number(price.price),
    currency: "TWD",
    isActive: Boolean(price.isActive),
  };
  if (existing.rows[0]) {
    await client.query(`
      UPDATE product_prices SET product_id = $2, scope_type = $3, scope_id = $4, price = $5, currency = $6, is_active = $7 WHERE id = $1
    `, [saved.id, saved.productId, saved.scopeType, saved.scopeId, saved.price, saved.currency, saved.isActive]);
    return saved;
  }
  await client.query(`
    INSERT INTO product_prices (id, product_id, scope_type, scope_id, price, currency, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (product_id, scope_type, (COALESCE(scope_id, '__null__'))) DO UPDATE SET id = EXCLUDED.id, price = EXCLUDED.price, currency = EXCLUDED.currency, is_active = EXCLUDED.is_active
  `, [saved.id, saved.productId, saved.scopeType, saved.scopeId, saved.price, saved.currency, saved.isActive]);
  return saved;
}

export async function upsertVisibilityRule(rule, client = pool) {
  const scopeId = rule.ruleType === "visible_to_all" ? null : rule.scopeId;
  const existing = rule.id
    ? await client.query("SELECT id FROM visibility_rules WHERE id = $1", [rule.id])
    : await client.query("SELECT id FROM visibility_rules WHERE product_id = $1 AND rule_type = $2 AND scope_id IS NOT DISTINCT FROM $3", [rule.productId, rule.ruleType, scopeId]);
  const saved = {
    id: existing.rows[0]?.id || rule.id || makeId("visibility"),
    productId: rule.productId,
    ruleType: rule.ruleType,
    scopeId,
    isActive: Boolean(rule.isActive),
  };
  if (existing.rows[0]) {
    await client.query(`
      UPDATE visibility_rules SET product_id = $2, rule_type = $3, scope_id = $4, is_active = $5 WHERE id = $1
    `, [saved.id, saved.productId, saved.ruleType, saved.scopeId, saved.isActive]);
    return saved;
  }
  await client.query(`
    INSERT INTO visibility_rules (id, product_id, rule_type, scope_id, is_active)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (product_id, rule_type, (COALESCE(scope_id, '__null__'))) DO UPDATE SET id = EXCLUDED.id, is_active = EXCLUDED.is_active
  `, [saved.id, saved.productId, saved.ruleType, saved.scopeId, saved.isActive]);
  return saved;
}

function normalizeLookup(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function resolveImportPriceScope(price, tiers, users) {
  if (price.scopeType === "default" || price.scopeName === "預設價格" || price.scopeName === "default") {
    return { scopeType: "default", scopeId: null };
  }
  if (price.scopeType === "customer") {
    const key = normalizeLookup(price.scopeName ?? price.scopeId);
    const customer = users.find((user) => user.role === "customer" && [user.id, user.name, user.loginId, user.companyName].some((value) => normalizeLookup(value) === key));
    return customer ? { scopeType: "customer", scopeId: customer.id } : null;
  }
  const key = normalizeLookup(price.scopeName ?? price.scopeId ?? price.tierName);
  const tier = tiers.find((entry) => [entry.id, entry.code, entry.name].some((value) => normalizeLookup(value) === key));
  return tier ? { scopeType: "customer_tier", scopeId: tier.id } : null;
}

export async function importProductsFromJson(payload) {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  if (products.length === 0) throw new Error("匯入 JSON 必須包含 products 陣列。");

  const client = await pool.connect();
  const result = { importedProducts: 0, importedPrices: 0, importedVisibilityRules: 0, skippedPrices: [], errors: [] };
  try {
    await client.query("BEGIN");
    const store = await readStore();
    for (const [index, entry] of products.entries()) {
      const sku = String(entry.sku ?? "").trim();
      const name = String(entry.name ?? "").trim();
      if (!sku || !name) {
        result.errors.push(`第 ${index + 1} 筆缺少 SKU 或商品名稱。`);
        continue;
      }

      const savedProduct = await upsertProduct({
        ...entry,
        sku,
        name,
        category: entry.category ?? payload.defaultCategory ?? "",
        brand: entry.brand ?? payload.defaultBrand ?? "",
        salesUnit: entry.salesUnit ?? entry.unit ?? "件",
        packSize: entry.packSize ?? entry.spec ?? "",
        moq: entry.moq ?? entry.orderIncrement ?? 1,
        orderIncrement: entry.orderIncrement ?? entry.moq ?? 1,
        stockQuantity: entry.stockQuantity ?? entry.stock ?? 0,
        isOrderable: entry.isOrderable ?? true,
        isActive: entry.isActive ?? true,
      }, client);
      result.importedProducts += 1;

      const prices = Array.isArray(entry.prices) ? entry.prices : [];
      for (const priceEntry of prices) {
        const price = Number(priceEntry.price);
        if (!Number.isFinite(price) || price < 0) continue;
        const scope = resolveImportPriceScope(priceEntry, store.customerTiers, store.users);
        if (!scope) {
          result.skippedPrices.push({ sku, scopeName: priceEntry.scopeName ?? priceEntry.tierName ?? priceEntry.scopeId ?? "", price });
          continue;
        }
        await upsertPrice({
          productId: savedProduct.id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          price,
          isActive: priceEntry.isActive ?? true,
        }, client);
        result.importedPrices += 1;
      }

      if (entry.visibleToAll ?? true) {
        await upsertVisibilityRule({ productId: savedProduct.id, ruleType: "visible_to_all", scopeId: null, isActive: true }, client);
        result.importedVisibilityRules += 1;
      }
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function insertOrder(order, client = pool) {
  await client.query(`
    INSERT INTO orders (id, order_no, customer_id, customer_snapshot, order_status, payment_status, selected_payment_method, subtotal, adjustment_total, freight_total, grand_total, customer_note, admin_note, submitted_at, confirmed_at)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO NOTHING
  `, [order.id, order.orderNo, order.customerId, JSON.stringify(order.customerSnapshot ?? null), order.orderStatus, order.paymentStatus, order.selectedPaymentMethod, order.subtotal, order.adjustmentTotal, order.freightTotal, order.grandTotal, order.customerNote ?? "", order.adminNote ?? "", order.submittedAt, order.confirmedAt ?? null]);
  for (const item of order.items ?? []) await upsertOrderItem(order.id, item, client);
  for (const revision of order.revisions ?? []) await insertRevision(order.id, revision, client);
  for (const record of order.paymentRecords ?? []) await insertPaymentRecord(order.id, record, client);
}

async function upsertOrderItem(orderId, item, client = pool) {
  await client.query(`
    INSERT INTO order_items (id, order_id, product_id, sku_snapshot, product_name_snapshot, brand_snapshot, sales_unit_snapshot, pack_size_snapshot, unit_price_snapshot, quantity, subtotal)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET unit_price_snapshot = EXCLUDED.unit_price_snapshot, quantity = EXCLUDED.quantity, subtotal = EXCLUDED.subtotal
  `, [item.id, orderId, item.productId, item.skuSnapshot, item.productNameSnapshot, item.brandSnapshot, item.salesUnitSnapshot, item.packSizeSnapshot, item.unitPriceSnapshot, item.quantity, item.subtotal]);
}

async function insertRevision(orderId, revision, client = pool) {
  await client.query(`
    INSERT INTO order_revisions (id, order_id, revised_by, previous_total, new_total, change_summary, before_snapshot, after_snapshot, customer_acceptance_required, customer_accepted_at, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET customer_accepted_at = EXCLUDED.customer_accepted_at
  `, [revision.id, orderId, revision.revisedBy, revision.previousTotal, revision.newTotal, revision.changeSummary, JSON.stringify(revision.beforeSnapshot ?? []), JSON.stringify(revision.afterSnapshot ?? []), Boolean(revision.customerAcceptanceRequired), revision.customerAcceptedAt ?? null, revision.createdAt]);
}

async function insertPaymentRecord(orderId, record, client = pool) {
  await client.query(`
    INSERT INTO payment_records (id, order_id, method, provider, amount, status, paid_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO NOTHING
  `, [record.id, orderId, record.method, record.provider, record.amount, record.status, record.paidAt ?? null]);
}

export async function createOrder(order) {
  await insertOrder(order);
}

export async function reviseOrder(orderId, revisionInput, adminName) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const store = await readStore();
    const order = store.orders.find((entry) => entry.id === orderId);
    if (!order) return null;
    const before = order.items.map((item) => ({ ...item }));
    const requestedItems = Array.isArray(revisionInput?.items) ? revisionInput.items : [];
    const after = order.items.map((item) => {
      const requested = requestedItems.find((entry) => entry.id === item.id || entry.productId === item.productId);
      const quantity = Math.max(0, Number(requested?.quantity ?? item.quantity) || 0);
      const unitPriceSnapshot = Math.max(0, Number(requested?.unitPriceSnapshot ?? item.unitPriceSnapshot) || 0);
      return { ...item, quantity, unitPriceSnapshot, subtotal: quantity * unitPriceSnapshot };
    }).filter((item) => item.quantity > 0);
    if (after.length === 0) throw new Error("訂單至少需要保留一個品項。");
    const adjustmentTotal = Number(revisionInput?.adjustmentTotal ?? order.adjustmentTotal) || 0;
    const freightTotal = Math.max(0, Number(revisionInput?.freightTotal ?? order.freightTotal) || 0);
    const subtotal = after.reduce((sum, item) => sum + item.subtotal, 0);
    const newTotal = subtotal + adjustmentTotal + freightTotal;
    const totalChanged = newTotal !== order.grandTotal;
    const revision = {
      id: makeId("rev"),
      revisedBy: adminName,
      previousTotal: order.grandTotal,
      newTotal,
      changeSummary: revisionInput?.changeSummary || "管理員已更新訂單內容。",
      beforeSnapshot: before,
      afterSnapshot: after,
      customerAcceptanceRequired: totalChanged,
      createdAt: now(),
    };
    await client.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
    for (const item of after) await upsertOrderItem(orderId, item, client);
    await client.query(`
      UPDATE orders SET subtotal = $1, adjustment_total = $2, freight_total = $3, grand_total = $4, order_status = $5, admin_note = $6 WHERE id = $7
    `, [subtotal, adjustmentTotal, freightTotal, newTotal, totalChanged ? "revised" : "confirmed", revisionInput?.adminNote ?? order.adminNote, orderId]);
    await insertRevision(orderId, revision, client);
    await client.query("COMMIT");
    return revision;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(orderId, orderStatus, adminNote) {
  const confirmedAt = orderStatus === "confirmed" ? now() : null;
  await pool.query(`
    UPDATE orders
    SET order_status = $1,
        admin_note = COALESCE($2, admin_note),
        confirmed_at = CASE WHEN $1 = 'confirmed' AND confirmed_at IS NULL THEN $3 ELSE confirmed_at END
    WHERE id = $4
  `, [orderStatus, adminNote ?? null, confirmedAt, orderId]);
}

export async function acceptRevision(orderId, customerId) {
  await pool.query("UPDATE orders SET order_status = 'customer_accepted_revision' WHERE id = $1 AND customer_id = $2", [orderId, customerId]);
  await pool.query(`
    UPDATE order_revisions SET customer_accepted_at = $1
    WHERE id = (
      SELECT id FROM order_revisions WHERE order_id = $2 ORDER BY created_at DESC LIMIT 1
    )
  `, [now(), orderId]);
}

export async function markPaid(orderId, method, amount) {
  await pool.query("UPDATE orders SET payment_status = 'paid' WHERE id = $1", [orderId]);
  await insertPaymentRecord(orderId, { id: makeId("pay"), method, provider: "manual", amount, status: "paid", paidAt: now() });
}
