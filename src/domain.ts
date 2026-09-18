import type { CustomerSnapshot, OrderStatus, PaymentMethod, PaymentStatus, Product, ProductPrice, Role, User } from "./types";

export const allCategory = "所有產品";
export const methodText: Record<PaymentMethod, string> = { monthly_billing: "月結", bank_transfer: "銀行轉帳", credit_card: "信用卡" };
export const roleText: Record<Role, string> = { admin: "管理員", customer: "客戶" };
export const statusText: Record<OrderStatus, string> = {
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
export const paymentText: Record<PaymentStatus, string> = {
  not_required: "不需付款",
  pending: "待付款",
  monthly_billing: "月結",
  paid: "已付款",
  failed: "付款失敗",
  cancelled: "已取消",
  refunded: "已退款",
};

export function adminTitle(tab: "orders" | "products" | "users" | "tiers") {
  return { orders: "訂單審核", products: "商品規則", users: "帳號管理", tiers: "客戶等級" }[tab];
}

export function money(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(date);
}

export function resolveProductPrice(productId: string, customer: User, prices: ProductPrice[]) {
  const active = prices.filter((price) => price.productId === productId && price.isActive);
  return active.find((price) => price.scopeType === "customer" && price.scopeId === customer.id)?.price
    ?? active.find((price) => price.scopeType === "customer_tier" && price.scopeId === customer.customerTierId)?.price
    ?? active.find((price) => price.scopeType === "default" && price.scopeId === null)?.price
    ?? null;
}

export function validateQuantity(product: Product, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return "訂購數量必須是正整數。";
  if (quantity < product.moq) return `最低訂購量為 ${product.moq} ${product.salesUnit}`;
  if ((quantity - product.moq) % product.orderIncrement !== 0) return `訂購數量需符合 ${product.orderIncrement} ${product.salesUnit} 的倍數`;
  return "";
}

export function customerProfileComplete(customer: User) {
  return Boolean(customer.taxId && customer.companyName && customer.contactName && customer.shippingAddress && customer.shippingDetail);
}

export function customerSnapshot(customer: User): CustomerSnapshot {
  return {
    taxId: customer.taxId ?? "",
    companyName: customer.companyName ?? "",
    contactName: customer.contactName ?? "",
    shippingAddress: customer.shippingAddress ?? "",
    shippingDetail: customer.shippingDetail ?? "",
  };
}
