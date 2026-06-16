import path from "node:path";
import fs from "node:fs/promises";
import XLSX from "xlsx";

const [, , inputPath, outputPathArg] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/convert-inventory-xls.js <inventory.xls> [output.json]");
  process.exit(1);
}

const workbook = XLSX.readFile(inputPath, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell).trim() === "貨品編號"));

if (headerIndex < 0) {
  console.error("找不到標題列：需要包含「貨品編號」。");
  process.exit(1);
}

const headers = rows[headerIndex].map((cell) => String(cell).trim());
const indexOf = (name) => headers.findIndex((header) => header === name);
const skuIndex = indexOf("貨品編號");
const nameIndex = indexOf("貨品名稱");
const specIndex = indexOf("規格");
const qtyIndex = indexOf("輔助數量");
const unitIndex = indexOf("輔助單位");
const stockIndex = indexOf("目前總數量");
const priceColumns = headers
  .map((header, index) => ({ header, index }))
  .filter(({ header }) => header && header.endsWith("價"));

function toNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

const products = rows.slice(headerIndex + 1)
  .map((row) => {
    const sku = String(row[skuIndex] ?? "").trim();
    const name = String(row[nameIndex] ?? "").trim();
    if (!sku || !name) return null;

    const orderQuantity = Math.max(1, toNumber(row[qtyIndex], 1));
    return {
      sku,
      name,
      brand: "",
      category: "",
      description: "",
      image: "",
      salesUnit: String(row[unitIndex] ?? "").trim() || "件",
      packSize: String(row[specIndex] ?? "").trim(),
      moq: orderQuantity,
      orderIncrement: orderQuantity,
      stockQuantity: Math.max(0, toNumber(row[stockIndex], 0)),
      isOrderable: true,
      isActive: true,
      visibleToAll: true,
      prices: priceColumns
        .map(({ header, index }) => ({ scopeType: "customer_tier", scopeName: header, price: toNumber(row[index], NaN), currency: "TWD", isActive: true }))
        .filter((price) => Number.isFinite(price.price)),
    };
  })
  .filter(Boolean);

const output = {
  schema: "ml-store-products-v1",
  sourceFile: path.basename(inputPath),
  convertedAt: new Date().toISOString(),
  notes: [
    "價格使用 Excel 欄名對應客戶等級名稱或代碼，例如：直營價、經銷價。",
    "規格寫入 packSize；輔助數量同時寫入 moq 與 orderIncrement。",
  ],
  products,
};

const outputPath = outputPathArg || inputPath.replace(/\.[^.]+$/, ".json");
await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Converted ${products.length} products to ${outputPath}`);
