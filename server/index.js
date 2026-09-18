import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptRevision,
  archiveProduct,
  clearProductTestData,
  createOrder,
  databaseUrl,
  deleteTier,
  deleteUser,
  findActiveUserById,
  findActiveUserByLoginId,
  importProductsFromJson,
  initDb,
  makeId,
  markPaid,
  nextOrderNo,
  now,
  patchProduct,
  publicUser,
  readCustomerStore,
  readStore,
  reviseOrder,
  updateOrderStatus,
  upsertPrice,
  upsertProduct,
  upsertTier,
  upsertUser,
  upsertVisibilityRule,
} from "./db.js";
import { buildCustomerCatalog, canCustomerSeeProduct, resolveProductPrice } from "./catalog.js";

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "0.0.0.0";
const isProduction = process.env.NODE_ENV === "production";
const defaultJwtSecret = "local-dev-secret-change-me";
const jwtSecret = process.env.JWT_SECRET?.trim() || defaultJwtSecret;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

if (isProduction && (jwtSecret === defaultJwtSecret || jwtSecret.length < 32)) {
  throw new Error("Production requires JWT_SECRET with at least 32 characters.");
}

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    try {
      const { hostname, port: originPort } = new URL(origin);
      const allowedHost = hostname === "localhost" || hostname === "127.0.0.1" || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname);
      return callback(null, allowedHost && originPort === "5173");
    } catch {
      return callback(null, false);
    }
  },
}));
app.use(express.json({ limit: "5mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "登入失敗次數過多，請稍後再試。" },
});
const invalidPasswordHash = bcrypt.hashSync("invalid-login-password", 10);

function validateQuantity(product, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return "訂購數量必須是正整數。";
  if (quantity < product.moq) return `最小訂購量為 ${product.moq} ${product.salesUnit}`;
  if ((quantity - product.moq) % product.orderIncrement !== 0) return `訂購數量需以 ${product.orderIncrement} ${product.salesUnit} 為倍數`;
  return "";
}

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "請先登入。" });
  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
    const user = await findActiveUserById(payload.sub);
    if (!user) return res.status(401).json({ message: "帳號不存在或已停用。" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "登入已失效，請重新登入。" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "需要管理員權限。" });
  next();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.post("/api/auth/login", loginLimiter, asyncRoute(async (req, res) => {
  const { loginId, password } = req.body ?? {};
  const user = await findActiveUserByLoginId(String(loginId ?? "").trim());
  const passwordMatches = await bcrypt.compare(String(password ?? ""), user?.passwordHash ?? invalidPasswordHash);
  if (!user || !passwordMatches) {
    return res.status(401).json({ message: "登入 ID 或密碼錯誤。" });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "8h" });
  res.json({ token, user: publicUser(user) });
}));

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch("/api/me", requireAuth, asyncRoute(async (req, res) => {
  const profile = req.body ?? {};
  if (profile.password && String(profile.password).length < 12) return res.status(400).json({ message: "新密碼至少需要 12 個字元。" });
  const saved = await upsertUser({
    ...req.user,
    name: profile.name ?? req.user.name,
    email: profile.email ?? req.user.email,
    password: profile.password || undefined,
    taxId: req.user.role === "customer" ? profile.taxId ?? req.user.taxId : req.user.taxId,
    companyName: req.user.role === "customer" ? profile.companyName ?? req.user.companyName : req.user.companyName,
    contactName: req.user.role === "customer" ? profile.contactName ?? req.user.contactName : req.user.contactName,
    shippingAddress: req.user.role === "customer" ? profile.shippingAddress ?? req.user.shippingAddress : req.user.shippingAddress,
    shippingDetail: req.user.role === "customer" ? profile.shippingDetail ?? req.user.shippingDetail : req.user.shippingDetail,
    allowedPaymentMethods: req.user.role === "customer" ? ["credit_card"] : req.user.allowedPaymentMethods,
  });
  res.json({ user: publicUser(saved) });
}));

app.get("/api/bootstrap", requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role === "customer") {
    const store = await readCustomerStore(req.user.id);
    const { products, prices } = buildCustomerCatalog(store, req.user);
    return res.json({
      customerTiers: [],
      users: [publicUser(req.user)],
      products,
      prices,
      visibilityRules: [],
      orders: store.orders.filter((order) => order.customerId === req.user.id),
    });
  }
  const store = await readStore();
  res.json({
    customerTiers: store.customerTiers,
    users: store.users.map(publicUser),
    products: store.products,
    prices: store.prices,
    visibilityRules: store.visibilityRules,
    orders: store.orders,
  });
}));

app.post("/api/users", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const store = await readStore();
  const user = req.body;
  if (!user?.name || !user?.loginId || !["admin", "customer"].includes(user.role)) {
    return res.status(400).json({ message: "請填寫名稱、登入 ID 與角色。" });
  }
  const existingUser = store.users.find((entry) => entry.id === user.id);
  if (!existingUser && String(user.password ?? "").length < 12) return res.status(400).json({ message: "新帳號密碼至少需要 12 個字元。" });
  if (existingUser && user.password && String(user.password).length < 12) return res.status(400).json({ message: "新密碼至少需要 12 個字元。" });
  const loginTaken = store.users.find((entry) => entry.loginId.toLowerCase() === String(user.loginId).toLowerCase() && entry.id !== user.id);
  if (loginTaken) return res.status(409).json({ message: "登入 ID 已被使用。" });
  const emailTaken = user.email && store.users.find((entry) => entry.email?.toLowerCase() === String(user.email).toLowerCase() && entry.id !== user.id);
  if (emailTaken) return res.status(409).json({ message: "Email 已被使用。" });
  await upsertUser(user);
  const updated = await readStore();
  res.json({ users: updated.users.map(publicUser) });
}));

app.delete("/api/users/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: "不能刪除目前登入中的管理員帳號。" });
  const deleted = await deleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ message: "找不到帳號。" });
  const updated = await readStore();
  res.json({ user: publicUser(deleted), users: updated.users.map(publicUser) });
}));

app.post("/api/customer-tiers", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const store = await readStore();
  const tier = req.body;
  if (!tier?.name || !tier?.code) return res.status(400).json({ message: "請填寫客戶等級名稱與代碼。" });
  const codeTaken = store.customerTiers.find((entry) => entry.code.toLowerCase() === String(tier.code).toLowerCase() && entry.id !== tier.id);
  if (codeTaken) return res.status(409).json({ message: "客戶等級代碼已存在。" });
  await upsertTier(tier);
  const updated = await readStore();
  res.json({ customerTiers: updated.customerTiers });
}));

app.delete("/api/customer-tiers/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const result = await deleteTier(req.params.id);
  if (!result) return res.status(404).json({ message: "找不到客戶等級。" });
  const updated = await readStore();
  res.json({
    result,
    customerTiers: updated.customerTiers,
    users: updated.users.map(publicUser),
    prices: updated.prices,
    visibilityRules: updated.visibilityRules,
  });
}));

app.post("/api/products", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const store = await readStore();
  const product = req.body;
  if (!product?.sku || !product?.name) return res.status(400).json({ message: "請填寫商品 SKU 與名稱。" });
  const skuTaken = store.products.find((entry) => entry.sku.toLowerCase() === String(product.sku).toLowerCase() && entry.id !== product.id);
  if (skuTaken) return res.status(409).json({ message: "商品 SKU 已存在。" });
  await upsertProduct(product);
  const updated = await readStore();
  res.json({ products: updated.products });
}));

app.delete("/api/products/test-data", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const result = await clearProductTestData();
  res.json({ result, products: [], prices: [], visibilityRules: [] });
}));

app.patch("/api/products/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const product = await patchProduct(req.params.id, req.body);
  if (!product) return res.status(404).json({ message: "找不到商品。" });
  res.json({ product });
}));

app.delete("/api/products/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const product = await archiveProduct(req.params.id);
  if (!product) return res.status(404).json({ message: "找不到商品。" });
  res.json({ product });
}));

app.post("/api/products/import", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const importResult = await importProductsFromJson(req.body);
  const updated = await readStore();
  res.json({
    result: importResult,
    products: updated.products,
    prices: updated.prices,
    visibilityRules: updated.visibilityRules,
  });
}));

app.post("/api/prices", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const store = await readStore();
  const price = req.body;
  const scopeTypes = ["default", "customer_tier", "customer"];
  if (!price?.productId || !scopeTypes.includes(price.scopeType) || Number(price.price) < 0) {
    return res.status(400).json({ message: "請選擇商品、價格類型並輸入有效價格。" });
  }
  if (price.scopeType !== "default" && !price.scopeId) return res.status(400).json({ message: "請選擇價格適用對象。" });
  if (!store.products.some((entry) => entry.id === price.productId)) return res.status(404).json({ message: "找不到商品。" });
  if (price.scopeType === "customer_tier" && !store.customerTiers.some((entry) => entry.id === price.scopeId)) return res.status(404).json({ message: "找不到客戶等級。" });
  if (price.scopeType === "customer" && !store.users.some((entry) => entry.id === price.scopeId && entry.role === "customer")) return res.status(404).json({ message: "找不到客戶帳號。" });
  await upsertPrice(price);
  const updated = await readStore();
  res.json({ prices: updated.prices });
}));

app.post("/api/visibility-rules", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const store = await readStore();
  const rule = req.body;
  const ruleTypes = ["visible_to_all", "visible_to_customer_tier", "visible_to_customer", "hidden_from_customer"];
  if (!rule?.productId || !ruleTypes.includes(rule.ruleType)) return res.status(400).json({ message: "請選擇商品與可見規則。" });
  if (rule.ruleType !== "visible_to_all" && !rule.scopeId) return res.status(400).json({ message: "請選擇規則適用對象。" });
  if (!store.products.some((entry) => entry.id === rule.productId)) return res.status(404).json({ message: "找不到商品。" });
  if (rule.ruleType === "visible_to_customer_tier" && !store.customerTiers.some((entry) => entry.id === rule.scopeId)) return res.status(404).json({ message: "找不到客戶等級。" });
  if (["visible_to_customer", "hidden_from_customer"].includes(rule.ruleType) && !store.users.some((entry) => entry.id === rule.scopeId && entry.role === "customer")) return res.status(404).json({ message: "找不到客戶帳號。" });
  await upsertVisibilityRule(rule);
  const updated = await readStore();
  res.json({ visibilityRules: updated.visibilityRules });
}));

app.post("/api/orders", requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ message: "只有客戶可以送出訂單。" });
  const store = await readCustomerStore(req.user.id);
  const { items, selectedPaymentMethod, customerNote } = req.body ?? {};
  const idempotencyKey = String(req.body?.idempotencyKey ?? "").trim();
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) return res.status(400).json({ message: "訂單識別碼無效，請重新整理後再試。" });
  if (selectedPaymentMethod !== "credit_card") return res.status(400).json({ message: "目前只接受信用卡付款。" });
  req.user.allowedPaymentMethods = ["credit_card"];
  const requiredProfileFields = ["taxId", "companyName", "contactName", "shippingAddress", "shippingDetail"];
  const missingProfile = requiredProfileFields.filter((field) => !String(req.user[field] ?? "").trim());
  if (missingProfile.length > 0) {
    return res.status(400).json({ message: "客戶資料尚未完整，請聯絡客服或管理員補齊統編、名稱、聯絡人與送貨資訊。" });
  }
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "購物車沒有可送出的商品。" });
  if (items.length > 500) return res.status(400).json({ message: "單張訂單最多包含 500 項商品。" });
  if (String(customerNote ?? "").length > 2000) return res.status(400).json({ message: "客戶備註不可超過 2000 字。" });
  if (!req.user.allowedPaymentMethods.includes(selectedPaymentMethod)) return res.status(400).json({ message: "此帳號不允許使用該付款方式。" });
  const productIds = items.map((item) => item?.productId);
  if (new Set(productIds).size !== productIds.length) return res.status(400).json({ message: "訂單不可包含重複商品。" });
  const productsById = new Map(store.products.map((product) => [product.id, product]));
  const orderItems = [];
  for (const item of items) {
    const product = productsById.get(item?.productId);
    if (!product || !canCustomerSeeProduct(product, req.user, store.visibilityRules)) return res.status(400).json({ message: "商品不存在或不可見。" });
    const price = resolveProductPrice(product.id, req.user, store.prices);
    if (!product.isOrderable || price === null) return res.status(400).json({ message: `${product.name} 目前不可下單。` });
    const quantity = Number(item.quantity);
    const error = validateQuantity(product, quantity);
    if (error) return res.status(400).json({ message: error });
    orderItems.push({
      id: makeId("item"),
      productId: product.id,
      skuSnapshot: product.sku,
      productNameSnapshot: product.name,
      brandSnapshot: product.brand,
      salesUnitSnapshot: product.salesUnit,
      packSizeSnapshot: product.packSize,
      unitPriceSnapshot: price,
      quantity,
      subtotal: price * quantity,
    });
  }
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const paymentStatus = "pending";
  const order = {
    id: makeId("order"),
    orderNo: await nextOrderNo(),
    customerId: req.user.id,
    idempotencyKey,
    customerSnapshot: {
      taxId: req.user.taxId,
      companyName: req.user.companyName,
      contactName: req.user.contactName,
      shippingAddress: req.user.shippingAddress,
      shippingDetail: req.user.shippingDetail,
    },
    orderStatus: "submitted",
    paymentStatus,
    selectedPaymentMethod,
    items: orderItems,
    subtotal,
    adjustmentTotal: 0,
    freightTotal: 0,
    grandTotal: subtotal,
    customerNote: String(customerNote ?? "").trim(),
    adminNote: "",
    submittedAt: now(),
    revisions: [],
    paymentRecords: [],
  };
  const creation = await createOrder(order);
  const updated = await readCustomerStore(req.user.id);
  const savedOrder = updated.orders.find((entry) => entry.id === creation.orderId);
  res.status(creation.created ? 201 : 200).json({ order: savedOrder, orders: updated.orders });
}));

app.post("/api/orders/:id/revise", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  try {
    const revision = await reviseOrder(req.params.id, req.body, req.user.name);
    if (!revision) return res.status(404).json({ message: "找不到訂單。" });
    const updated = await readStore();
    res.json({ orders: updated.orders });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}));

app.post("/api/orders/:id/status", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const allowedStatuses = ["admin_reviewing", "confirmed", "processing", "shipped", "completed", "cancelled"];
  if (!allowedStatuses.includes(req.body?.orderStatus)) return res.status(400).json({ message: "不支援的訂單狀態。" });
  await updateOrderStatus(req.params.id, req.body.orderStatus, req.body?.adminNote);
  const updated = await readStore();
  const order = updated.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ message: "找不到訂單。" });
  res.json({ order, orders: updated.orders });
}));

app.post("/api/orders/:id/accept-revision", requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ message: "只有客戶可以接受訂單修訂。" });
  const accepted = await acceptRevision(req.params.id, req.user.id);
  if (!accepted) return res.status(404).json({ message: "找不到可接受的訂單修訂。" });
  const updated = await readCustomerStore(req.user.id);
  const order = updated.orders.find((entry) => entry.id === req.params.id);
  res.json({ order, orders: updated.orders });
}));

app.post("/api/orders/:id/mark-paid", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const store = await readStore();
  const order = store.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ message: "找不到訂單。" });
  await markPaid(order.id, order.selectedPaymentMethod, order.grandTotal);
  const updated = await readStore();
  res.json({ order: updated.orders.find((entry) => entry.id === order.id), orders: updated.orders });
}));

if (isProduction) {
  app.use(express.static(distDir));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "伺服器發生錯誤，請稍後再試。" });
});

await initDb();

app.listen(port, host, () => {
  const safeUrl = databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
  console.log(`B2B Store API listening on http://${host}:${port}`);
  console.log(`PostgreSQL: ${safeUrl}`);
});
