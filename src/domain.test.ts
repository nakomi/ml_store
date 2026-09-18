import { describe, expect, it } from "vitest";
import { formatDateTime, resolveProductPrice, validateQuantity } from "./domain";
import type { Product, ProductPrice, User } from "./types";

const customer = { id: "customer-a", customerTierId: "tier-a" } as User;
const product = { id: "product-a", moq: 12, orderIncrement: 6, salesUnit: "瓶" } as Product;

describe("resolveProductPrice", () => {
  it("uses customer price before tier and default prices", () => {
    const prices = [
      { productId: product.id, scopeType: "default", scopeId: null, price: 300, isActive: true },
      { productId: product.id, scopeType: "customer_tier", scopeId: "tier-a", price: 250, isActive: true },
      { productId: product.id, scopeType: "customer", scopeId: customer.id, price: 200, isActive: true },
    ] as ProductPrice[];
    expect(resolveProductPrice(product.id, customer, prices)).toBe(200);
  });
});

describe("validateQuantity", () => {
  it("accepts MOQ plus valid increments", () => {
    expect(validateQuantity(product, 12)).toBe("");
    expect(validateQuantity(product, 18)).toBe("");
  });

  it("rejects invalid, fractional, or below-MOQ quantities", () => {
    expect(validateQuantity(product, 0)).not.toBe("");
    expect(validateQuantity(product, 12.5)).not.toBe("");
    expect(validateQuantity(product, 13)).not.toBe("");
  });
});

describe("formatDateTime", () => {
  it("renders absolute timestamps in the Taipei time zone", () => {
    const formatted = formatDateTime("2026-09-18T00:30:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/8:30|08:30/);
  });
});
