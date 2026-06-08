import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  CreditCard,
  Download,
  Eye,
  Filter,
  History,
  LogIn,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import "./styles.css";

type Role = "admin" | "customer";
type PriceScope = "default" | "customer_tier" | "customer";
type VisibilityRuleType = "visible_to_all" | "visible_to_customer_tier" | "visible_to_customer" | "hidden_from_customer";
type PaymentMethod = "monthly_billing" | "bank_transfer" | "credit_card";
type PaymentStatus = "not_required" | "pending" | "monthly_billing" | "paid" | "failed" | "cancelled" | "refunded";
type OrderStatus = "submitted" | "admin_reviewing" | "revised" | "customer_accepted_revision" | "confirmed" | "processing" | "shipped" | "completed" | "cancelled";

type CustomerTier = { id: string; code: string; name: string; isActive: boolean };
type User = {
  id: string;
  loginId: string;
  name: string;
  email: string;
  role: Role;
  customerTierId?: string;
  allowedPaymentMethods: PaymentMethod[];
  isActive: boolean;
  taxId?: string;
  companyName?: string;
  contactName?: string;
  shippingAddress?: string;
  shippingDetail?: string;
};
type Product = { id: string; sku: string; name: string; brand: string; series: string; category: string; description: string; image: string; salesUnit: string; packSize: string; moq: number; orderIncrement: number; isOrderable: boolean; isActive: boolean };
type ProductPrice = { id: string; productId: string; scopeType: PriceScope; scopeId: string | null; price: number; currency: "TWD"; isActive: boolean };
type VisibilityRule = { id: string; productId: string; ruleType: VisibilityRuleType; scopeId: string | null; isActive: boolean };
type CartItem = { productId: string; quantity: number };
type OrderItem = { id: string; productId: string; skuSnapshot: string; productNameSnapshot: string; brandSnapshot: string; salesUnitSnapshot: string; packSizeSnapshot: string; unitPriceSnapshot: number; quantity: number; subtotal: number };
type OrderRevision = { id: string; revisedBy: string; previousTotal: number; newTotal: number; changeSummary: string; beforeSnapshot: OrderItem[]; afterSnapshot: OrderItem[]; customerAcceptanceRequired: boolean; customerAcceptedAt?: string; createdAt: string };
type PaymentRecord = { id: string; method: PaymentMethod; provider: "manual" | "ecpay" | "newebpay" | "tappay"; amount: number; status: PaymentStatus; paidAt?: string };
type CustomerSnapshot = { taxId: string; companyName: string; contactName: string; shippingAddress: string; shippingDetail: string };
type Order = { id: string; orderNo: string; customerId: string; customerSnapshot?: CustomerSnapshot; orderStatus: OrderStatus; paymentStatus: PaymentStatus; selectedPaymentMethod: PaymentMethod; items: OrderItem[]; subtotal: number; adjustmentTotal: number; freightTotal: number; grandTotal: number; customerNote: string; adminNote: string; submittedAt: string; confirmedAt?: string; revisions: OrderRevision[]; paymentRecords: PaymentRecord[] };
type Bootstrap = { customerTiers: CustomerTier[]; users: User[]; products: Product[]; prices: ProductPrice[]; visibilityRules: VisibilityRule[]; orders: Order[] };

const allCategory = "全部";
const methodText: Record<PaymentMethod, string> = { monthly_billing: "月結", bank_transfer: "銀行轉帳", credit_card: "信用卡" };
const roleText: Record<Role, string> = { admin: "管理員", customer: "客戶" };
const statusText: Record<OrderStatus, string> = {
  submitted: "已送出",
  admin_reviewing: "管理員審核中",
  revised: "訂單已修訂",
  customer_accepted_revision: "客戶已接受修訂",
  confirmed: "已確認",
  processing: "處理中",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
};
const paymentText: Record<PaymentStatus, string> = {
  not_required: "不需付款",
  pending: "待付款",
  monthly_billing: "月結",
  paid: "已付款",
  failed: "付款失敗",
  cancelled: "已取消",
  refunded: "已退款",
};

function adminTitle(tab: "orders" | "products" | "users" | "tiers") {
  const titles = {
    orders: "訂單審核",
    products: "商品規則",
    users: "帳號管理",
    tiers: "客戶等級",
  };
  return titles[tab];
}

function money(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function resolveProductPrice(productId: string, customer: User, prices: ProductPrice[]) {
  const active = prices.filter((price) => price.productId === productId && price.isActive);
  return active.find((price) => price.scopeType === "customer" && price.scopeId === customer.id)?.price
    ?? active.find((price) => price.scopeType === "customer_tier" && price.scopeId === customer.customerTierId)?.price
    ?? active.find((price) => price.scopeType === "default" && price.scopeId === null)?.price
    ?? null;
}

function hasRule(rules: VisibilityRule[], productId: string, ruleType: VisibilityRuleType, scopeId: string | null) {
  return rules.some((rule) => rule.productId === productId && rule.ruleType === ruleType && rule.scopeId === scopeId && rule.isActive);
}

function canCustomerSeeProduct(product: Product, customer: User, rules: VisibilityRule[]) {
  if (!product.isActive) return false;
  if (hasRule(rules, product.id, "hidden_from_customer", customer.id)) return false;
  if (hasRule(rules, product.id, "visible_to_customer", customer.id)) return true;
  if (customer.customerTierId && hasRule(rules, product.id, "visible_to_customer_tier", customer.customerTierId)) return true;
  return hasRule(rules, product.id, "visible_to_all", null);
}

function validateQuantity(product: Product, quantity: number) {
  if (quantity < product.moq) return `最低訂購量為 ${product.moq} ${product.salesUnit}`;
  if ((quantity - product.moq) % product.orderIncrement !== 0) return `訂購數量需符合 ${product.orderIncrement} ${product.salesUnit} 的倍數`;
  return "";
}

function customerProfileComplete(customer: User) {
  return Boolean(customer.taxId && customer.companyName && customer.contactName && customer.shippingAddress && customer.shippingDetail);
}

function customerSnapshot(customer: User): CustomerSnapshot {
  return {
    taxId: customer.taxId ?? "",
    companyName: customer.companyName ?? "",
    contactName: customer.contactName ?? "",
    shippingAddress: customer.shippingAddress ?? "",
    shippingDetail: customer.shippingDetail ?? "",
  };
}

function xmlEscape(value: string | number | undefined) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function downloadExcelXml(fileName: string, sheets: { name: string; rows: Record<string, string | number | undefined>[] }[]) {
  const sheetXml = (name: string, rows: Record<string, string | number | undefined>[]) => {
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const headerRow = `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join("")}</Row>`;
    const bodyRows = rows.map((row) => `<Row>${headers.map((header) => `<Cell><Data ss:Type="${typeof row[header] === "number" ? "Number" : "String"}">${xmlEscape(row[header])}</Data></Cell>`).join("")}</Row>`).join("");
    return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${headerRow}${bodyRows}</Table></Worksheet>`;
  };
  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets.map((sheet) => sheetXml(sheet.name, sheet.rows)).join("")}</Workbook>`;
  const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function apiRequest<T>(path: string, token: string | null, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "系統發生錯誤。");
  return data as T;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("b2b-token"));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<"customer" | "admin">("customer");
  const [adminTab, setAdminTab] = useState<"orders" | "products" | "users" | "tiers">("orders");
  const [notice, setNotice] = useState("請登入後開始使用。");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(allCategory);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [customerNote, setCustomerNote] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "confirm" | "thankyou">("cart");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [catalogView, setCatalogView] = useState<"grid" | "list">("grid");

  async function loadBootstrap(authToken = token) {
    if (!authToken) return;
    setData(await apiRequest<Bootstrap>("/api/bootstrap", authToken));
  }

  useEffect(() => {
    if (!token) return;
    apiRequest<{ user: User }>("/api/me", token)
      .then(({ user }) => {
        setCurrentUser(user);
        setView(user.role === "admin" ? "admin" : "customer");
        setSelectedPaymentMethod(user.allowedPaymentMethods[0] ?? "bank_transfer");
        return loadBootstrap(token);
      })
      .catch(() => {
        localStorage.removeItem("b2b-token");
        setToken(null);
      });
  }, [token]);

  async function login(loginId: string, password: string) {
    const result = await apiRequest<{ token: string; user: User }>("/api/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ loginId, password }),
    });
    localStorage.setItem("b2b-token", result.token);
    setToken(result.token);
    setCurrentUser(result.user);
    setNotice(`${result.user.name} 已登入。`);
  }

  function logout() {
    localStorage.removeItem("b2b-token");
    setToken(null);
    setCurrentUser(null);
    setData(null);
    setCart([]);
    setNotice("已登出。");
  }

  if (!token || !currentUser || !data) return <LoginScreen login={login} notice={notice} />;

  const appData = data;
  const customer = currentUser.role === "customer" ? currentUser : appData.users.find((user) => user.role === "customer") ?? currentUser;
  const visibleProducts = appData.products
    .filter((product) => currentUser.role === "admin" || canCustomerSeeProduct(product, customer, appData.visibilityRules))
    .filter((product) => category === allCategory || product.category === category)
    .filter((product) => {
      const keyword = query.trim().toLowerCase();
      return !keyword || [product.sku, product.name, product.brand, product.series].some((value) => value.toLowerCase().includes(keyword));
    });
  const categories = [allCategory, ...Array.from(new Set(appData.products.map((product) => product.category)))];
  const cartRows = cart.map((item) => {
    const product = appData.products.find((entry) => entry.id === item.productId)!;
    const price = resolveProductPrice(product.id, customer, appData.prices) ?? 0;
    return { product, quantity: item.quantity, price, subtotal: price * item.quantity };
  });
  const cartTotal = cartRows.reduce((sum, row) => sum + row.subtotal, 0);

  function addToCart(product: Product) {
    const price = resolveProductPrice(product.id, customer, appData.prices);
    if (!product.isOrderable || price === null) {
      setNotice(`${product.name} 目前不可加入購物車。`);
      return;
    }
    setCart((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) return items.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + product.orderIncrement } : item);
      return [...items, { productId: product.id, quantity: product.moq }];
    });
    setCheckoutStep("cart");
    setNotice(`${product.name} 已加入購物車。`);
  }

  function updateCart(productId: string, quantity: number) {
    const product = appData.products.find((entry) => entry.id === productId)!;
    const error = validateQuantity(product, quantity);
    if (error) setNotice(error);
    setCart((items) => items.map((item) => item.productId === productId ? { ...item, quantity } : item));
  }

  function goToConfirm() {
    const invalid = cartRows.find((row) => validateQuantity(row.product, row.quantity));
    if (cartRows.length === 0) return setNotice("購物車沒有可送出的商品。");
    if (invalid) return setNotice(validateQuantity(invalid.product, invalid.quantity));
    if (!customerProfileComplete(customer)) return setNotice("客戶資料尚未完整，請聯絡客服或管理員補齊統編、名稱、聯絡人與送貨資訊。");
    setAgreedToTerms(false);
    setCheckoutStep("confirm");
  }

  async function submitOrder() {
    if (!agreedToTerms) return setNotice("請先勾選同意訂購條款。");
    const result = await apiRequest<{ order: Order; orders: Order[] }>("/api/orders", token, {
      method: "POST",
      body: JSON.stringify({ items: cart, selectedPaymentMethod, customerNote }),
    });
    setData((prev) => prev ? { ...prev, orders: result.orders } : prev);
    setSubmittedOrder(result.order);
    setCart([]);
    setCustomerNote("");
    setAgreedToTerms(false);
    setCheckoutStep("thankyou");
    setNotice("訂單已送出，等待管理員確認。");
  }

  async function saveUser(user: User & { password?: string }) {
    const result = await apiRequest<{ users: User[] }>("/api/users", token, { method: "POST", body: JSON.stringify(user) });
    setData((prev) => prev ? { ...prev, users: result.users } : prev);
    setNotice(`${roleText[user.role]} ${user.name} 已儲存。`);
  }

  async function saveTier(tier: CustomerTier & { description?: string }) {
    const result = await apiRequest<{ customerTiers: CustomerTier[] }>("/api/customer-tiers", token, { method: "POST", body: JSON.stringify(tier) });
    setData((prev) => prev ? { ...prev, customerTiers: result.customerTiers } : prev);
    setNotice(`客戶等級 ${tier.name} 已儲存。`);
  }

  async function toggleProductOrderable(product: Product, isOrderable: boolean) {
    const result = await apiRequest<{ product: Product }>(`/api/products/${product.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ isOrderable }),
    });
    setData((prev) => prev ? { ...prev, products: prev.products.map((entry) => entry.id === product.id ? result.product : entry) } : prev);
  }

  async function reviseOrder(orderId: string) {
    const result = await apiRequest<{ orders: Order[] }>(`/api/orders/${orderId}/revise`, token, { method: "POST" });
    setData((prev) => prev ? { ...prev, orders: result.orders } : prev);
    setNotice("已建立訂單修訂紀錄。");
  }

  async function acceptRevision(orderId: string) {
    const result = await apiRequest<{ orders: Order[] }>(`/api/orders/${orderId}/accept-revision`, token, { method: "POST" });
    setData((prev) => prev ? { ...prev, orders: result.orders } : prev);
    setNotice("已接受訂單修訂。");
  }

  async function markPaid(orderId: string) {
    const result = await apiRequest<{ orders: Order[] }>(`/api/orders/${orderId}/mark-paid`, token, { method: "POST" });
    setData((prev) => prev ? { ...prev, orders: result.orders } : prev);
    setNotice("已將付款狀態更新為已付款。");
  }

  function exportOrders() {
    const summary = appData.orders.map((order) => ({
      "Order No": order.orderNo,
      "Customer Name": appData.users.find((user) => user.id === order.customerId)?.name,
      "Company Name": order.customerSnapshot?.companyName,
      "Tax ID": order.customerSnapshot?.taxId,
      "Contact": order.customerSnapshot?.contactName,
      "Shipping Address": order.customerSnapshot?.shippingAddress,
      "Shipping Detail": order.customerSnapshot?.shippingDetail,
      "Order Status": statusText[order.orderStatus],
      "Payment Method": methodText[order.selectedPaymentMethod],
      "Payment Status": paymentText[order.paymentStatus],
      Subtotal: order.subtotal,
      "Grand Total": order.grandTotal,
      "Submitted At": order.submittedAt,
      "Customer Note": order.customerNote,
      "Admin Note": order.adminNote,
    }));
    const detail = appData.orders.flatMap((order) => order.items.map((item) => ({
      "Order No": order.orderNo,
      "Customer Name": appData.users.find((user) => user.id === order.customerId)?.name,
      SKU: item.skuSnapshot,
      "Product Name": item.productNameSnapshot,
      Brand: item.brandSnapshot,
      Quantity: item.quantity,
      "Unit Price": item.unitPriceSnapshot,
      Subtotal: item.subtotal,
    })));
    downloadExcelXml("b2b-orders.xls", [{ name: "訂單總表", rows: summary }, { name: "訂單明細", rows: detail }]);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><Package aria-hidden /><div><strong>工廠 B2B 訂購</strong><span>客戶專屬型錄與價格</span></div></div>
        <nav>
          <button className={view === "customer" ? "active" : ""} onClick={() => setView("customer")}><ShoppingCart size={18} /> 客戶訂購</button>
          {currentUser.role === "admin" ? <>
            <div className="sideNavLabel">管理後台</div>
            <button className={view === "admin" && adminTab === "orders" ? "active" : ""} onClick={() => { setView("admin"); setAdminTab("orders"); }}><Settings size={18} /> 訂單審核</button>
            <button className={view === "admin" && adminTab === "products" ? "active" : ""} onClick={() => { setView("admin"); setAdminTab("products"); }}><Package size={18} /> 商品規則</button>
            <button className={view === "admin" && adminTab === "users" ? "active" : ""} onClick={() => { setView("admin"); setAdminTab("users"); }}><UserRound size={18} /> 帳號管理</button>
            <button className={view === "admin" && adminTab === "tiers" ? "active" : ""} onClick={() => { setView("admin"); setAdminTab("tiers"); }}><Filter size={18} /> 客戶等級</button>
          </> : null}
        </nav>
        <div className="account">
          <UserRound size={18} />
          <div><strong>{currentUser.name}</strong><span>{roleText[currentUser.role]} · {currentUser.loginId}</span></div>
          <button onClick={logout}>登出</button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div><p className="eyebrow">{roleText[currentUser.role]}</p><h1>{view === "admin" ? adminTitle(adminTab) : "商品訂購"}</h1></div>
          <div className="notice"><Bell size={18} /><span>{notice}</span></div>
        </header>
        {view === "customer" ? (
          <CustomerPortal
            products={visibleProducts}
            customer={customer}
            prices={appData.prices}
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            categories={categories}
            catalogView={catalogView}
            setCatalogView={setCatalogView}
            addToCart={addToCart}
            openDetail={setSelectedProduct}
            cartRows={cartRows}
            updateCart={updateCart}
            setCart={setCart}
            cartTotal={cartTotal}
            selectedPaymentMethod={selectedPaymentMethod}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
            customerNote={customerNote}
            setCustomerNote={setCustomerNote}
            goToConfirm={goToConfirm}
            submitOrder={submitOrder}
            checkoutStep={checkoutStep}
            setCheckoutStep={setCheckoutStep}
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={setAgreedToTerms}
            submittedOrder={submittedOrder}
            orders={appData.orders.filter((order) => order.customerId === customer.id)}
            acceptRevision={acceptRevision}
            canOrder={currentUser.role === "customer"}
          />
        ) : (
          <AdminPortal
            users={appData.users}
            tiers={appData.customerTiers}
            adminTab={adminTab}
            saveUser={saveUser}
            saveTier={saveTier}
            products={appData.products}
            prices={appData.prices}
            rules={appData.visibilityRules}
            orders={appData.orders}
            toggleProductOrderable={toggleProductOrderable}
            reviseOrder={reviseOrder}
            markPaid={markPaid}
            exportOrders={exportOrders}
          />
        )}
      </main>
      {selectedProduct ? <ProductDetailModal product={selectedProduct} customer={customer} prices={appData.prices} addToCart={addToCart} close={() => setSelectedProduct(null)} canOrder={currentUser.role === "customer"} /> : null}
    </div>
  );
}

function LoginScreen(props: { login: (loginId: string, password: string) => Promise<void>; notice: string }) {
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await props.login(loginId, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗。");
    }
  }
  return (
    <main className="loginPage">
      <form className="loginPanel" onSubmit={submit}>
        <Package size={34} />
        <h1>工廠 B2B 訂購入口</h1>
        <p>請使用管理員或客戶帳號登入。</p>
        <label>登入 ID<input value={loginId} onChange={(event) => setLoginId(event.target.value)} /></label>
        <label>密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="primaryAction" type="submit"><LogIn size={18} /> 登入</button>
        <div className="loginHint">範例：admin / admin123，hotel / customer123</div>
        {error ? <p className="formError">{error}</p> : <p className="empty">{props.notice}</p>}
      </form>
    </main>
  );
}

function CustomerInfo(props: { customer: User }) {
  return (
    <div className="infoBox">
      <h3>客戶資料</h3>
      <dl className="compactList">
        <div><dt>統編</dt><dd>{props.customer.taxId || "未設定"}</dd></div>
        <div><dt>名稱</dt><dd>{props.customer.companyName || props.customer.name}</dd></div>
        <div><dt>聯絡人</dt><dd>{props.customer.contactName || "未設定"}</dd></div>
        <div><dt>送貨地點</dt><dd>{props.customer.shippingAddress || "未設定"}</dd></div>
        <div><dt>送貨詳細</dt><dd>{props.customer.shippingDetail || "未設定"}</dd></div>
      </dl>
      <p className="lockedNote">客戶資料不可自行更改，如需調整請聯絡客服或管理員。</p>
    </div>
  );
}

function CustomerPortal(props: {
  products: Product[];
  customer: User;
  prices: ProductPrice[];
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: string[];
  catalogView: "grid" | "list";
  setCatalogView: (view: "grid" | "list") => void;
  addToCart: (product: Product) => void;
  openDetail: (product: Product) => void;
  cartRows: { product: Product; quantity: number; price: number; subtotal: number }[];
  updateCart: (productId: string, quantity: number) => void;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  cartTotal: number;
  selectedPaymentMethod: PaymentMethod;
  setSelectedPaymentMethod: (value: PaymentMethod) => void;
  customerNote: string;
  setCustomerNote: (value: string) => void;
  goToConfirm: () => void;
  submitOrder: () => void;
  checkoutStep: "cart" | "confirm" | "thankyou";
  setCheckoutStep: (step: "cart" | "confirm" | "thankyou") => void;
  agreedToTerms: boolean;
  setAgreedToTerms: (value: boolean) => void;
  submittedOrder: Order | null;
  orders: Order[];
  acceptRevision: (orderId: string) => void;
  canOrder: boolean;
}) {
  return (
    <div className="workspace">
      <section className="catalog">
        <div className="sectionHeader">
          <div><h2>商品清單</h2><p>只顯示此客戶可見商品，價格依客戶、等級、預設價依序解析。</p></div>
          <div className="tools">
            <label className="inputWithIcon"><Search size={17} /><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="搜尋 SKU、品名、品牌" /></label>
            <label className="inputWithIcon select"><Filter size={17} /><select value={props.category} onChange={(event) => props.setCategory(event.target.value)}>{props.categories.map((name) => <option key={name}>{name}</option>)}</select></label>
            <div className="segmentedControl" aria-label="商品檢視模式">
              <button className={props.catalogView === "grid" ? "active" : ""} onClick={() => props.setCatalogView("grid")}>Grid</button>
              <button className={props.catalogView === "list" ? "active" : ""} onClick={() => props.setCatalogView("list")}>List</button>
            </div>
          </div>
        </div>
        {props.catalogView === "list" ? <ProductList {...props} /> : <ProductGrid {...props} />}
      </section>
      <aside className="rightPanel">
        {props.checkoutStep === "confirm" ? <ConfirmPanel {...props} /> : props.checkoutStep === "thankyou" ? <ThankYouPanel order={props.submittedOrder} customer={props.customer} back={() => props.setCheckoutStep("cart")} /> : <CartPanel {...props} />}
        <section>
          <h2>訂單紀錄</h2>
          {props.orders.length === 0 ? <p className="empty">尚無訂單。</p> : props.orders.map((order) => (
            <div className="orderMini" key={order.id}>
              <div><strong>{order.orderNo}</strong><span>{statusText[order.orderStatus]} · {paymentText[order.paymentStatus]}</span></div><b>{money(order.grandTotal)}</b>
              {order.revisions[0]?.customerAcceptanceRequired && !order.revisions[0].customerAcceptedAt && props.canOrder ? <button onClick={() => props.acceptRevision(order.id)}>接受修訂</button> : null}
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}

function ProductGrid(props: Parameters<typeof CustomerPortal>[0]) {
  return (
    <div className="productGrid">
      {props.products.map((product) => {
        const price = resolveProductPrice(product.id, props.customer, props.prices);
        const canAdd = props.canOrder && product.isOrderable && price !== null;
        return (
          <article className="productCard" key={product.id}>
            <button className="imageButton" onClick={() => props.openDetail(product)} aria-label={`查看 ${product.name}`}><img src={product.image} alt={product.name} /></button>
            <div className="productBody">
              <div className="sku">{product.sku}</div><h3>{product.name}</h3><p>{product.description}</p>
              <div className="meta"><span>{product.brand}</span><span>{product.series}</span><span>MOQ {product.moq} {product.salesUnit}</span></div>
              <div className="cardFooter">
                <strong>{price === null ? "請洽業務" : money(price)}</strong>
                <div className="inlineActions"><button onClick={() => props.openDetail(product)}><Eye size={17} /> 詳情</button><button disabled={!canAdd} onClick={() => props.addToCart(product)}><ShoppingCart size={17} /> {canAdd ? "加入購物車" : "請洽業務"}</button></div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProductList(props: Parameters<typeof CustomerPortal>[0]) {
  return (
    <div className="productList">
      <div className="productListHead"><span>SKU</span><span>商品</span><span>規格</span><span>MOQ</span><span>價格</span><span>操作</span></div>
      {props.products.map((product) => {
        const price = resolveProductPrice(product.id, props.customer, props.prices);
        const canAdd = props.canOrder && product.isOrderable && price !== null;
        return (
          <div className="productListRow" key={product.id}>
            <strong>{product.sku}</strong>
            <div><span>{product.name}</span><small>{product.brand} · {product.series}</small></div>
            <span>{product.packSize}</span>
            <span>{product.moq} {product.salesUnit}</span>
            <strong>{price === null ? "請洽業務" : money(price)}</strong>
            <div className="rowActions"><button onClick={() => props.openDetail(product)}>詳情</button><button disabled={!canAdd} onClick={() => props.addToCart(product)}>{canAdd ? "加入購物車" : "請洽業務"}</button></div>
          </div>
        );
      })}
    </div>
  );
}

function CartPanel(props: Parameters<typeof CustomerPortal>[0]) {
  return (
    <section>
      <h2>購物車</h2>
      <CustomerInfo customer={props.customer} />
      {!props.canOrder ? <p className="empty">管理員預覽客戶型錄時不能送出訂單。</p> : props.cartRows.length === 0 ? <p className="empty">尚未加入商品。</p> : props.cartRows.map((row) => (
        <div className="cartLine" key={row.product.id}>
          <div><strong>{row.product.name}</strong><span>{row.product.sku}</span></div>
          <input type="number" min={row.product.moq} step={row.product.orderIncrement} value={row.quantity} onChange={(event) => props.updateCart(row.product.id, Number(event.target.value))} />
          <b>{money(row.subtotal)}</b><button className="iconButton" onClick={() => props.setCart((items) => items.filter((item) => item.productId !== row.product.id))}>刪除</button>
        </div>
      ))}
      <div className="totalRow"><span>總計</span><strong>{money(props.cartTotal)}</strong></div>
      <label>付款方式<select disabled={!props.canOrder} value={props.selectedPaymentMethod} onChange={(event) => props.setSelectedPaymentMethod(event.target.value as PaymentMethod)}>{props.customer.allowedPaymentMethods.map((method) => <option value={method} key={method}>{methodText[method]}</option>)}</select></label>
      <label>客戶備註<textarea disabled={!props.canOrder} value={props.customerNote} onChange={(event) => props.setCustomerNote(event.target.value)} placeholder="出貨、對帳或其他備註" /></label>
      <button className="primaryAction" disabled={!props.canOrder || props.cartRows.length === 0} onClick={props.goToConfirm}><LogIn size={18} /> 前往確認</button>
    </section>
  );
}

function ConfirmPanel(props: Parameters<typeof CustomerPortal>[0]) {
  return (
    <section>
      <h2>確認訂單</h2>
      <CustomerInfo customer={props.customer} />
      <div className="confirmLines">
        {props.cartRows.map((row) => <div key={row.product.id}><span>{row.product.name} × {row.quantity}</span><strong>{money(row.subtotal)}</strong></div>)}
      </div>
      <div className="totalRow"><span>總計</span><strong>{money(props.cartTotal)}</strong></div>
      <div className="infoBox">
        <h3>訂購條款</h3>
        <p>送出訂單後，訂單仍需由管理員確認。若管理員修改數量、價格或總額，客戶需再次接受修訂後才會進入後續付款或出貨流程。</p>
        <label className="switchLabel"><input type="checkbox" checked={props.agreedToTerms} onChange={(event) => props.setAgreedToTerms(event.target.checked)} />我已確認訂單內容、客戶資料與送貨資訊，並同意訂購條款。</label>
      </div>
      <div className="rowActions"><button onClick={() => props.setCheckoutStep("cart")}>返回購物車</button><button className="primaryAction" disabled={!props.agreedToTerms} onClick={props.submitOrder}>確認送出</button></div>
    </section>
  );
}

function ThankYouPanel(props: { order: Order | null; customer: User; back: () => void }) {
  const snapshot = props.order?.customerSnapshot ?? customerSnapshot(props.customer);
  return (
    <section>
      <h2>謝謝您的訂單</h2>
      <p className="empty">訂單已送出，管理員確認後會通知您後續狀態。</p>
      <div className="infoBox">
        <h3>{props.order?.orderNo ?? "訂單"}</h3>
        <dl className="compactList">
          <div><dt>統編</dt><dd>{snapshot.taxId}</dd></div>
          <div><dt>名稱</dt><dd>{snapshot.companyName}</dd></div>
          <div><dt>聯絡人</dt><dd>{snapshot.contactName}</dd></div>
          <div><dt>送貨地點</dt><dd>{snapshot.shippingAddress}</dd></div>
          <div><dt>送貨詳細</dt><dd>{snapshot.shippingDetail}</dd></div>
        </dl>
      </div>
      <button className="primaryAction" onClick={props.back}>回到商品清單</button>
    </section>
  );
}

function ProductDetailModal(props: { product: Product; customer: User; prices: ProductPrice[]; addToCart: (product: Product) => void; close: () => void; canOrder: boolean }) {
  const price = resolveProductPrice(props.product.id, props.customer, props.prices);
  const canAdd = props.canOrder && props.product.isOrderable && price !== null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="detailModal">
        <button className="modalClose" onClick={props.close}>關閉</button><img src={props.product.image} alt={props.product.name} />
        <div className="detailContent">
          <div className="sku">{props.product.sku}</div><h2>{props.product.name}</h2><p>{props.product.description}</p>
          <dl className="detailList">
            <div><dt>品牌</dt><dd>{props.product.brand}</dd></div><div><dt>系列</dt><dd>{props.product.series}</dd></div><div><dt>分類</dt><dd>{props.product.category}</dd></div><div><dt>銷售單位</dt><dd>{props.product.salesUnit}</dd></div><div><dt>包裝規格</dt><dd>{props.product.packSize}</dd></div><div><dt>MOQ</dt><dd>{props.product.moq} {props.product.salesUnit}</dd></div><div><dt>訂購倍數</dt><dd>{props.product.orderIncrement} {props.product.salesUnit}</dd></div><div><dt>價格</dt><dd>{price === null ? "請洽業務" : money(price)}</dd></div>
          </dl>
          <button className="primaryAction" disabled={!canAdd} onClick={() => props.addToCart(props.product)}><ShoppingCart size={18} /> {canAdd ? "加入購物車" : "請洽業務"}</button>
        </div>
      </div>
    </div>
  );
}

function AdminPortal(props: {
  users: User[];
  tiers: CustomerTier[];
  adminTab: "orders" | "products" | "users" | "tiers";
  saveUser: (user: User & { password?: string }) => void;
  saveTier: (tier: CustomerTier & { description?: string }) => void;
  products: Product[];
  prices: ProductPrice[];
  rules: VisibilityRule[];
  orders: Order[];
  toggleProductOrderable: (product: Product, isOrderable: boolean) => void;
  reviseOrder: (orderId: string) => void;
  markPaid: (orderId: string) => void;
  exportOrders: () => void;
}) {
  return (
    <div className="adminGrid">
      {props.adminTab === "orders" ? <OrderManager users={props.users} orders={props.orders} reviseOrder={props.reviseOrder} markPaid={props.markPaid} exportOrders={props.exportOrders} /> : null}
      {props.adminTab === "products" ? <ProductRuleManager products={props.products} prices={props.prices} rules={props.rules} toggleProductOrderable={props.toggleProductOrderable} /> : null}
      {props.adminTab === "users" ? <UserManager users={props.users} tiers={props.tiers} saveUser={props.saveUser} /> : null}
      {props.adminTab === "tiers" ? <TierManager tiers={props.tiers} saveTier={props.saveTier} /> : null}
    </div>
  );
}

function ProductRuleManager(props: {
  products: Product[];
  prices: ProductPrice[];
  rules: VisibilityRule[];
  toggleProductOrderable: (product: Product, isOrderable: boolean) => void;
}) {
  return (
    <section className="fullSpan"><div className="sectionHeader"><div><h2>商品與規則</h2><p>商品可見性與可下單狀態分開管理。</p></div></div>
      <div className="adminTable"><div className="tableHead productColumns"><span>SKU</span><span>商品</span><span>狀態</span><span>價格規則</span><span>可見性</span></div>
        {props.products.map((product) => <div className="tableRow productColumns" key={product.id}><strong>{product.sku}</strong><span>{product.name}</span><label className="switchLabel"><input type="checkbox" checked={product.isOrderable} onChange={(event) => props.toggleProductOrderable(product, event.target.checked)} />{product.isOrderable ? "可下單" : "不可下單"}</label><span>{props.prices.filter((price) => price.productId === product.id && price.isActive).length} 筆</span><span>{props.rules.filter((rule) => rule.productId === product.id && rule.isActive).length} 筆</span></div>)}
      </div>
    </section>
  );
}

function OrderManager(props: {
  users: User[];
  orders: Order[];
  reviseOrder: (orderId: string) => void;
  markPaid: (orderId: string) => void;
  exportOrders: () => void;
}) {
  return (
    <section className="fullSpan"><div className="sectionHeader"><div><h2>訂單審核</h2><p>管理員可修訂訂單、建立修訂紀錄，付款狀態獨立管理。</p></div><button onClick={props.exportOrders}><Download size={18} /> 匯出 Excel</button></div>
      <div className="adminTable"><div className="tableHead orderColumns"><span>訂單編號</span><span>客戶</span><span>訂單狀態</span><span>付款</span><span>總計</span><span>操作</span></div>
        {props.orders.length === 0 ? <p className="empty tableEmpty">尚無訂單，請先以客戶身分送出訂單。</p> : props.orders.map((order) => <div className="tableRow orderColumns" key={order.id}><strong>{order.orderNo}</strong><span>{props.users.find((user) => user.id === order.customerId)?.name}</span><span>{statusText[order.orderStatus]}</span><span>{paymentText[order.paymentStatus]}</span><strong>{money(order.grandTotal)}</strong><div className="rowActions"><button onClick={() => props.reviseOrder(order.id)}><History size={16} /> 修訂</button><button onClick={() => props.markPaid(order.id)}><CreditCard size={16} /> 已付款</button></div></div>)}
      </div>
    </section>
  );
}

function TierManager(props: { tiers: CustomerTier[]; saveTier: (tier: CustomerTier & { description?: string }) => void }) {
  const newTier = (): CustomerTier & { description?: string } => ({ id: `tier-${Date.now()}`, code: "", name: "", description: "", isActive: true });
  const [editing, setEditing] = useState<CustomerTier & { description?: string }>(newTier);
  function save() {
    if (!editing.code.trim() || !editing.name.trim()) return;
    props.saveTier(editing);
    setEditing(newTier());
  }
  return (
    <section className="fullSpan">
      <div className="sectionHeader">
        <div><h2>客戶等級管理</h2><p>客戶等級會影響商品價格、可見性與可下單規則。</p></div>
        <button onClick={() => setEditing(newTier())}><Plus size={18} /> 新增等級</button>
      </div>
      <div className="accountGrid">
        <div className="adminTable">
          <div className="tableHead tierColumns"><span>代碼</span><span>名稱</span><span>狀態</span><span>操作</span></div>
          {props.tiers.map((tier) => (
            <div className="tableRow tierColumns" key={tier.id}>
              <strong>{tier.code}</strong>
              <span>{tier.name}</span>
              <span>{tier.isActive ? "啟用" : "停用"}</span>
              <button onClick={() => setEditing(tier)}>編輯</button>
            </div>
          ))}
        </div>
        <div className="editPanel">
          <h3>{props.tiers.some((tier) => tier.id === editing.id) ? "編輯等級" : "新增等級"}</h3>
          <label>等級代碼<input value={editing.code} onChange={(event) => setEditing({ ...editing, code: event.target.value })} placeholder="例如：A、Hotel、OEM" /></label>
          <label>等級名稱<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="例如：飯店通路" /></label>
          <label>說明<textarea value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="內部備註，可留空" /></label>
          <label className="switchLabel"><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} />啟用等級</label>
          <button className="primaryAction" onClick={save}><Save size={18} /> 儲存等級</button>
        </div>
      </div>
    </section>
  );
}

function UserManager(props: { users: User[]; tiers: CustomerTier[]; saveUser: (user: User & { password?: string }) => void }) {
  const newUser = (): User & { password?: string } => ({ id: `user-${Date.now()}`, loginId: "", name: "", email: "", password: "changeme123", role: "customer", customerTierId: props.tiers[0]?.id, allowedPaymentMethods: ["bank_transfer"], isActive: true, taxId: "", companyName: "", contactName: "", shippingAddress: "", shippingDetail: "" });
  const [editing, setEditing] = useState<User & { password?: string }>(newUser);
  function toggleMethod(method: PaymentMethod) {
    setEditing((user) => ({ ...user, allowedPaymentMethods: user.allowedPaymentMethods.includes(method) ? user.allowedPaymentMethods.filter((entry) => entry !== method) : [...user.allowedPaymentMethods, method] }));
  }
  function save() {
    if (!editing.name.trim() || !editing.loginId.trim()) return;
    props.saveUser(editing);
    setEditing(newUser());
  }
  return (
    <section className="fullSpan">
      <div className="sectionHeader"><div><h2>帳號管理</h2><p>客戶統編、名稱、聯絡人與送貨資訊只能由客服或管理員維護。</p></div><button onClick={() => setEditing(newUser())}><Plus size={18} /> 新增帳號</button></div>
      <div className="accountGrid">
        <div className="adminTable"><div className="tableHead userColumns"><span>登入 ID</span><span>名稱 / Email</span><span>角色</span><span>狀態</span><span>操作</span></div>
          {props.users.map((user) => <div className="tableRow userColumns" key={user.id}><strong>{user.loginId}</strong><span>{user.name}<small>{user.email || "未設定 email"}</small></span><span>{roleText[user.role]}</span><span>{user.isActive ? "啟用" : "停用"}</span><button onClick={() => setEditing({ ...user, password: "" })}>編輯</button></div>)}
        </div>
        <div className="editPanel">
          <h3>{props.users.some((user) => user.id === editing.id) ? "編輯帳號" : "新增帳號"}</h3>
          <label>登入 ID<input value={editing.loginId} onChange={(event) => setEditing({ ...editing, loginId: event.target.value })} placeholder="例如：admin、hotel01" /></label>
          <label>帳號顯示名稱<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="例如：沐森旅店" /></label>
          <label>Email<input value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} placeholder="通知用，可留空" /></label>
          <label>密碼<input type="password" value={editing.password ?? ""} onChange={(event) => setEditing({ ...editing, password: event.target.value })} placeholder="留空代表不變更密碼" /></label>
          <label>角色<select value={editing.role} onChange={(event) => setEditing({ ...editing, role: event.target.value as Role })}><option value="admin">管理員</option><option value="customer">客戶</option></select></label>
          {editing.role === "customer" ? <>
            <label>客戶等級<select value={editing.customerTierId} onChange={(event) => setEditing({ ...editing, customerTierId: event.target.value })}>{props.tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
            <label>統編<input value={editing.taxId ?? ""} onChange={(event) => setEditing({ ...editing, taxId: event.target.value })} /></label>
            <label>名稱<input value={editing.companyName ?? ""} onChange={(event) => setEditing({ ...editing, companyName: event.target.value })} /></label>
            <label>聯絡人<input value={editing.contactName ?? ""} onChange={(event) => setEditing({ ...editing, contactName: event.target.value })} /></label>
            <label>送貨地點<input value={editing.shippingAddress ?? ""} onChange={(event) => setEditing({ ...editing, shippingAddress: event.target.value })} /></label>
            <label>送貨詳細<textarea value={editing.shippingDetail ?? ""} onChange={(event) => setEditing({ ...editing, shippingDetail: event.target.value })} /></label>
            <div className="checkboxGroup"><span>允許付款方式</span>{(Object.keys(methodText) as PaymentMethod[]).map((method) => <label key={method}><input type="checkbox" checked={editing.allowedPaymentMethods.includes(method)} onChange={() => toggleMethod(method)} /> {methodText[method]}</label>)}</div>
          </> : null}
          <label className="switchLabel"><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} />啟用帳號</label>
          <button className="primaryAction" onClick={save}><Save size={18} /> 儲存帳號</button>
        </div>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
