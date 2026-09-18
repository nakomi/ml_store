import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerCatalog, canCustomerSeeProduct, resolveProductPrice } from "./catalog.js";

const customer = { id: "customer-a", customerTierId: "tier-a" };
const products = [
  { id: "public", isActive: true, stockQuantity: 500 },
  { id: "private", isActive: true },
  { id: "hidden", isActive: true },
  { id: "inactive", isActive: false },
];
const visibilityRules = [
  { productId: "public", ruleType: "visible_to_all", scopeId: null, isActive: true },
  { productId: "private", ruleType: "visible_to_customer_tier", scopeId: "tier-a", isActive: true },
  { productId: "hidden", ruleType: "visible_to_all", scopeId: null, isActive: true },
  { productId: "hidden", ruleType: "hidden_from_customer", scopeId: "customer-a", isActive: true },
  { productId: "inactive", ruleType: "visible_to_all", scopeId: null, isActive: true },
];

test("customer-specific price wins over tier and default prices", () => {
  const prices = [
    { productId: "public", scopeType: "default", scopeId: null, price: 300, isActive: true },
    { productId: "public", scopeType: "customer_tier", scopeId: "tier-a", price: 250, isActive: true },
    { productId: "public", scopeType: "customer", scopeId: "customer-a", price: 200, isActive: true },
  ];
  assert.equal(resolveProductPrice("public", customer, prices), 200);
});

test("explicit customer exclusion overrides other visibility rules", () => {
  assert.equal(canCustomerSeeProduct(products[2], customer, visibilityRules), false);
});

test("customer catalog contains only visible products and effective prices", () => {
  const store = {
    products,
    visibilityRules,
    prices: [
      { productId: "public", scopeType: "default", scopeId: null, price: 300, isActive: true },
      { productId: "public", scopeType: "customer", scopeId: "customer-b", price: 100, isActive: true },
      { productId: "private", scopeType: "customer_tier", scopeId: "tier-a", price: 500, isActive: true },
      { productId: "hidden", scopeType: "default", scopeId: null, price: 50, isActive: true },
    ],
  };
  const catalog = buildCustomerCatalog(store, customer);
  assert.deepEqual(catalog.products.map((product) => product.id), ["public", "private"]);
  assert.deepEqual(catalog.prices.map((price) => ({ productId: price.productId, price: price.price })), [
    { productId: "public", price: 300 },
    { productId: "private", price: 500 },
  ]);
  assert.ok(catalog.prices.every((price) => price.scopeId === customer.id));
  assert.equal("stockQuantity" in catalog.products[0], false);
});
