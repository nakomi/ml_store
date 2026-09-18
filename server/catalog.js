export function resolveProductPrice(productId, customer, prices) {
  const active = prices.filter((price) => price.productId === productId && price.isActive);
  return active.find((price) => price.scopeType === "customer" && price.scopeId === customer.id)?.price
    ?? active.find((price) => price.scopeType === "customer_tier" && price.scopeId === customer.customerTierId)?.price
    ?? active.find((price) => price.scopeType === "default" && price.scopeId === null)?.price
    ?? null;
}

function hasRule(rules, productId, ruleType, scopeId) {
  return rules.some((rule) => rule.productId === productId && rule.ruleType === ruleType && rule.scopeId === scopeId && rule.isActive);
}

export function canCustomerSeeProduct(product, customer, rules) {
  if (!product.isActive) return false;
  if (hasRule(rules, product.id, "hidden_from_customer", customer.id)) return false;
  if (hasRule(rules, product.id, "visible_to_customer", customer.id)) return true;
  if (customer.customerTierId && hasRule(rules, product.id, "visible_to_customer_tier", customer.customerTierId)) return true;
  return hasRule(rules, product.id, "visible_to_all", null);
}

export function buildCustomerCatalog(store, customer) {
  const visibleProducts = store.products.filter((product) => canCustomerSeeProduct(product, customer, store.visibilityRules));
  const products = visibleProducts.map(({ stockQuantity, ...product }) => product);
  const prices = products.flatMap((product) => {
    const price = resolveProductPrice(product.id, customer, store.prices);
    return price === null ? [] : [{
      id: `effective-${product.id}`,
      productId: product.id,
      scopeType: "customer",
      scopeId: customer.id,
      price,
      currency: "TWD",
      isActive: true,
    }];
  });
  return { products, prices };
}
