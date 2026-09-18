import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import * as XLSX from "xlsx";

const execFileAsync = promisify(execFile);
XLSX.set_fs(fs);

test("converts an inventory workbook to the product import schema", async () => {
  const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ml-store-inventory-"));
  const inputPath = path.join(tempDirectory, "inventory.xlsx");
  const outputPath = path.join(tempDirectory, "inventory.json");

  try {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["貨品編號", "貨品名稱", "規格", "輔助數量", "輔助單位", "目前總數量", "直營價"],
      ["TEST-001", "測試商品", "12 件/箱", 12, "件", 24, 100],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "商品");
    XLSX.writeFile(workbook, inputPath);

    await execFileAsync(process.execPath, [path.resolve("scripts", "convert-inventory-xls.js"), inputPath, outputPath]);
    const result = JSON.parse(await fs.promises.readFile(outputPath, "utf8"));

    assert.equal(result.schema, "ml-store-products-v1");
    assert.equal(result.products.length, 1);
    assert.deepEqual(result.products[0], {
      sku: "TEST-001",
      name: "測試商品",
      brand: "",
      category: "",
      description: "",
      image: "",
      salesUnit: "件",
      packSize: "12 件/箱",
      moq: 12,
      orderIncrement: 12,
      stockQuantity: 24,
      isOrderable: true,
      isActive: true,
      visibleToAll: true,
      prices: [{
        scopeType: "customer_tier",
        scopeName: "直營",
        scopeCode: "distributor",
        price: 100,
        currency: "TWD",
        isActive: true,
      }],
    });
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true });
  }
});
