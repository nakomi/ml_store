import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
const jwtSecret = process.env.JWT_SECRET ?? "local-dev-secret-change-me";
const dataDir = path.resolve("data");
const storePath = path.join(dataDir, "store.json");

app.use(cors({ origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }));
app.use(express.json({ limit: "1mb" }));

function now() {
  return new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function defaultLoginId(user) {
  return user.loginId || String(user.email ?? "").split("@")[0] || user.id;
}

const defaultCustomerProfiles = {
  "cust-1": {
    taxId: "24567890",
    companyName: "沐森旅店股份有限公司",
    contactName: "林店長",
    shippingAddress: "台北市中山區南京東路二段 100 號",
    shippingDetail: "1 樓收貨區，週一至週五 10:00-17:00 可收貨",
  },
  "cust-2": {
    taxId: "87654321",
    companyName: "青禾沙龍工作室",
    contactName: "陳小姐",
    shippingAddress: "新北市板橋區文化路一段 88 號",
    shippingDetail: "請送至 3 樓櫃台",
  },
};

function normalizeStore(store) {
  let changed = false;
  store.users = store.users.map((user) => {
    const defaultProfile = user.role === "customer" ? defaultCustomerProfiles[user.id] ?? {} : {};
    const normalizedUser = {
      ...user,
      loginId: user.loginId || defaultLoginId(user),
      taxId: user.taxId || defaultProfile.taxId || "",
      companyName: !user.companyName || user.companyName === user.name ? defaultProfile.companyName || user.name || "" : user.companyName,
      contactName: user.contactName || defaultProfile.contactName || user.name || "",
      shippingAddress: user.shippingAddress || defaultProfile.shippingAddress || "",
      shippingDetail: user.shippingDetail || defaultProfile.shippingDetail || "",
    };
    if (JSON.stringify(normalizedUser) !== JSON.stringify(user)) changed = true;
    return normalizedUser;
  });
  return { store, changed };
}

function seedStore() {
  const adminHash = bcrypt.hashSync("admin123", 10);
  const customerHash = bcrypt.hashSync("customer123", 10);
  return {
    customerTiers: [
      { id: "tier-a", code: "A", name: "A 級客戶", isActive: true },
      { id: "tier-hotel", code: "Hotel", name: "飯店通路", isActive: true },
      { id: "tier-oem", code: "OEM", name: "OEM 客戶", isActive: true },
    ],
    users: [
      { id: "admin-1", loginId: "admin", name: "工廠管理員", email: "admin@example.com", role: "admin", allowedPaymentMethods: [], isActive: true, passwordHash: adminHash },
      { id: "cust-1", loginId: "hotel", name: "沐森旅店", email: "hotel@example.com", role: "customer", customerTierId: "tier-hotel", allowedPaymentMethods: ["monthly_billing", "bank_transfer"], isActive: true, taxId: "24567890", companyName: "沐森旅店股份有限公司", contactName: "林店長", shippingAddress: "台北市中山區南京東路二段 100 號", shippingDetail: "1 樓收貨區，週一至週五 10:00-17:00 可收貨", passwordHash: customerHash },
      { id: "cust-2", loginId: "salon", name: "青禾沙龍", email: "salon@example.com", role: "customer", customerTierId: "tier-a", allowedPaymentMethods: ["bank_transfer", "credit_card"], isActive: true, taxId: "87654321", companyName: "青禾沙龍工作室", contactName: "陳小姐", shippingAddress: "新北市板橋區文化路一段 88 號", shippingDetail: "請送至 3 樓櫃台", passwordHash: customerHash },
    ],
    products: [
      { id: "p1", sku: "SH-001-300", name: "柔順洗髮精 300ml", brand: "ML Lab", series: "植萃護理", category: "洗沐", description: "飯店與沙龍常備的小容量洗髮精。", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80", salesUnit: "瓶", packSize: "24 瓶/箱", moq: 24, orderIncrement: 24, isOrderable: true, isActive: true },
      { id: "p2", sku: "SH-001-4000", name: "柔順洗髮精 4000ml", brand: "ML Lab", series: "植萃護理", category: "洗沐", description: "補充桶規格，適合大量消耗客戶。", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80", salesUnit: "桶", packSize: "4 桶/箱", moq: 4, orderIncrement: 4, isOrderable: true, isActive: true },
      { id: "p3", sku: "OEM-FACE-001", name: "OEM 溫和潔面乳", brand: "Private Label", series: "OEM", category: "臉部保養", description: "需專案報價，僅對指定客戶顯示。", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=80", salesUnit: "支", packSize: "120 支/箱", moq: 120, orderIncrement: 120, isOrderable: false, isActive: true },
      { id: "p4", sku: "BD-002-500", name: "草本沐浴乳 500ml", brand: "Aroma Pro", series: "草本系列", category: "洗沐", description: "有價格但目前暫停下單。", image: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=900&q=80", salesUnit: "瓶", packSize: "12 瓶/箱", moq: 12, orderIncrement: 12, isOrderable: false, isActive: true },
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

function readStore() {
  if (!fs.existsSync(storePath)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(seedStore(), null, 2), "utf8");
  }
  const { store, changed } = normalizeStore(JSON.parse(fs.readFileSync(storePath, "utf8")));
  if (changed) writeStore(store);
  return store;
}

function writeStore(store) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "請先登入。" });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const store = readStore();
    const user = store.users.find((entry) => entry.id === payload.sub && entry.isActive);
    if (!user) return res.status(401).json({ message: "帳號不存在或已停用。" });
    req.user = user;
    req.store = store;
    next();
  } catch {
    res.status(401).json({ message: "登入已過期，請重新登入。" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "沒有管理員權限。" });
  next();
}

function resolveProductPrice(productId, customer, prices) {
  const active = prices.filter((price) => price.productId === productId && price.isActive);
  return active.find((price) => price.scopeType === "customer" && price.scopeId === customer.id)?.price
    ?? active.find((price) => price.scopeType === "customer_tier" && price.scopeId === customer.customerTierId)?.price
    ?? active.find((price) => price.scopeType === "default" && price.scopeId === null)?.price
    ?? null;
}

function hasRule(rules, productId, ruleType, scopeId) {
  return rules.some((rule) => rule.productId === productId && rule.ruleType === ruleType && rule.scopeId === scopeId && rule.isActive);
}

function canCustomerSeeProduct(product, customer, rules) {
  if (!product.isActive) return false;
  if (hasRule(rules, product.id, "hidden_from_customer", customer.id)) return false;
  if (hasRule(rules, product.id, "visible_to_customer", customer.id)) return true;
  if (customer.customerTierId && hasRule(rules, product.id, "visible_to_customer_tier", customer.customerTierId)) return true;
  return hasRule(rules, product.id, "visible_to_all", null);
}

function validateQuantity(product, quantity) {
  if (quantity < product.moq) return `最低訂購量為 ${product.moq} ${product.salesUnit}`;
  if ((quantity - product.moq) % product.orderIncrement !== 0) return `訂購數量需符合 ${product.orderIncrement} ${product.salesUnit} 的倍數`;
  return "";
}

app.post("/api/auth/login", (req, res) => {
  const { loginId, password } = req.body ?? {};
  const store = readStore();
  const normalizedLoginId = String(loginId ?? "").trim().toLowerCase();
  const user = store.users.find((entry) => String(entry.loginId ?? "").toLowerCase() === normalizedLoginId && entry.isActive);
  if (!user || !bcrypt.compareSync(String(password ?? ""), user.passwordHash)) {
    return res.status(401).json({ message: "登入 ID 或密碼錯誤。" });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "8h" });
  res.json({ token, user: publicUser(user) });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/bootstrap", requireAuth, (req, res) => {
  const store = req.store;
  const orders = req.user.role === "admin" ? store.orders : store.orders.filter((order) => order.customerId === req.user.id);
  res.json({
    customerTiers: store.customerTiers,
    users: req.user.role === "admin" ? store.users.map(publicUser) : [publicUser(req.user)],
    products: store.products,
    prices: store.prices,
    visibilityRules: store.visibilityRules,
    orders,
  });
});

app.post("/api/users", requireAuth, requireAdmin, (req, res) => {
  const store = req.store;
  const user = req.body;
  if (!user?.name || !user?.loginId || !["admin", "customer"].includes(user.role)) {
    return res.status(400).json({ message: "請填寫名稱、登入 ID 與角色。" });
  }
  const existingByLoginId = store.users.find((entry) => String(entry.loginId).toLowerCase() === String(user.loginId).toLowerCase() && entry.id !== user.id);
  if (existingByLoginId) return res.status(409).json({ message: "登入 ID 已被其他帳號使用。" });
  const existingByEmail = store.users.find((entry) => entry.email.toLowerCase() === user.email.toLowerCase() && entry.id !== user.id);
  if (user.email && existingByEmail) return res.status(409).json({ message: "Email 已被其他帳號使用。" });
  const existing = store.users.find((entry) => entry.id === user.id);
  const savedUser = {
    id: user.id || makeId("user"),
    loginId: user.loginId,
    name: user.name,
    email: user.email ?? "",
    role: user.role,
    customerTierId: user.role === "customer" ? user.customerTierId : undefined,
    allowedPaymentMethods: user.role === "customer" ? user.allowedPaymentMethods ?? [] : [],
    taxId: user.role === "customer" ? user.taxId ?? "" : "",
    companyName: user.role === "customer" ? user.companyName ?? user.name : "",
    contactName: user.role === "customer" ? user.contactName ?? "" : "",
    shippingAddress: user.role === "customer" ? user.shippingAddress ?? "" : "",
    shippingDetail: user.role === "customer" ? user.shippingDetail ?? "" : "",
    isActive: Boolean(user.isActive),
    passwordHash: user.password ? bcrypt.hashSync(user.password, 10) : existing?.passwordHash ?? bcrypt.hashSync("changeme123", 10),
  };
  store.users = existing ? store.users.map((entry) => entry.id === savedUser.id ? savedUser : entry) : [...store.users, savedUser];
  writeStore(store);
  res.json({ user: publicUser(savedUser), users: store.users.map(publicUser) });
});

app.post("/api/customer-tiers", requireAuth, requireAdmin, (req, res) => {
  const store = req.store;
  const tier = req.body;
  if (!tier?.name || !tier?.code) {
    return res.status(400).json({ message: "請填寫客戶等級名稱與代碼。" });
  }
  const existingByCode = store.customerTiers.find((entry) => String(entry.code).toLowerCase() === String(tier.code).toLowerCase() && entry.id !== tier.id);
  if (existingByCode) return res.status(409).json({ message: "客戶等級代碼已存在。" });
  const existing = store.customerTiers.find((entry) => entry.id === tier.id);
  const savedTier = {
    id: tier.id || makeId("tier"),
    code: tier.code,
    name: tier.name,
    description: tier.description ?? "",
    isActive: Boolean(tier.isActive),
  };
  store.customerTiers = existing
    ? store.customerTiers.map((entry) => entry.id === savedTier.id ? savedTier : entry)
    : [...store.customerTiers, savedTier];
  writeStore(store);
  res.json({ tier: savedTier, customerTiers: store.customerTiers });
});

app.patch("/api/products/:id", requireAuth, requireAdmin, (req, res) => {
  const store = req.store;
  const product = store.products.find((entry) => entry.id === req.params.id);
  if (!product) return res.status(404).json({ message: "找不到商品。" });
  Object.assign(product, req.body);
  writeStore(store);
  res.json({ product });
});

app.post("/api/orders", requireAuth, (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ message: "只有客戶可以送出訂單。" });
  const store = req.store;
  const { items, selectedPaymentMethod, customerNote } = req.body ?? {};
  const requiredProfileFields = ["taxId", "companyName", "contactName", "shippingAddress", "shippingDetail"];
  const missingProfile = requiredProfileFields.filter((field) => !String(req.user[field] ?? "").trim());
  if (missingProfile.length > 0) {
    return res.status(400).json({ message: "客戶資料尚未完整，請聯絡客服或管理員補齊統編、名稱、聯絡人與送貨資訊。" });
  }
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "購物車沒有可送出的商品。" });
  if (!req.user.allowedPaymentMethods.includes(selectedPaymentMethod)) return res.status(400).json({ message: "此帳號不允許使用該付款方式。" });
  const orderItems = [];
  for (const item of items) {
    const product = store.products.find((entry) => entry.id === item.productId);
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
  const paymentStatus = selectedPaymentMethod === "monthly_billing" ? "monthly_billing" : "pending";
  const order = {
    id: makeId("order"),
    orderNo: `B2B-${String(store.orders.length + 1).padStart(5, "0")}`,
    customerId: req.user.id,
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
    customerNote: customerNote ?? "",
    adminNote: "",
    submittedAt: now(),
    revisions: [],
    paymentRecords: selectedPaymentMethod === "bank_transfer" ? [{ id: makeId("pay"), method: "bank_transfer", provider: "manual", amount: subtotal, status: "pending" }] : [],
  };
  store.orders.unshift(order);
  writeStore(store);
  res.status(201).json({ order, orders: store.orders.filter((entry) => entry.customerId === req.user.id) });
});

app.post("/api/orders/:id/revise", requireAuth, requireAdmin, (req, res) => {
  const store = req.store;
  const order = store.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ message: "找不到訂單。" });
  const before = order.items;
  const after = order.items.map((item, index) => index === 0 ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPriceSnapshot } : item);
  const newTotal = after.reduce((sum, item) => sum + item.subtotal, 0) + order.adjustmentTotal + order.freightTotal;
  const totalChanged = newTotal !== order.grandTotal;
  const revision = {
    id: makeId("rev"),
    revisedBy: req.user.name,
    previousTotal: order.grandTotal,
    newTotal,
    changeSummary: "管理員調整第一項商品數量，系統已重新計算總額。",
    beforeSnapshot: before,
    afterSnapshot: after,
    customerAcceptanceRequired: totalChanged,
    createdAt: now(),
  };
  order.items = after;
  order.subtotal = after.reduce((sum, item) => sum + item.subtotal, 0);
  order.grandTotal = newTotal;
  order.orderStatus = totalChanged ? "revised" : "confirmed";
  order.adminNote = "已完成訂單審核，請客戶確認修訂內容。";
  order.revisions = [revision, ...order.revisions];
  writeStore(store);
  res.json({ order, orders: store.orders });
});

app.post("/api/orders/:id/accept-revision", requireAuth, (req, res) => {
  const store = req.store;
  const order = store.orders.find((entry) => entry.id === req.params.id && entry.customerId === req.user.id);
  if (!order) return res.status(404).json({ message: "找不到訂單。" });
  order.orderStatus = "customer_accepted_revision";
  if (order.revisions[0]) order.revisions[0].customerAcceptedAt = now();
  writeStore(store);
  res.json({ order, orders: store.orders.filter((entry) => entry.customerId === req.user.id) });
});

app.post("/api/orders/:id/mark-paid", requireAuth, requireAdmin, (req, res) => {
  const store = req.store;
  const order = store.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ message: "找不到訂單。" });
  order.paymentStatus = "paid";
  order.paymentRecords.push({ id: makeId("pay"), method: order.selectedPaymentMethod, provider: "manual", amount: order.grandTotal, status: "paid", paidAt: now() });
  writeStore(store);
  res.json({ order, orders: store.orders });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`B2B Store API listening on http://127.0.0.1:${port}`);
});
