function xmlEscape(value: string | number | undefined) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function downloadExcelXml(fileName: string, sheets: { name: string; rows: Record<string, string | number | undefined>[] }[]) {
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

export function downloadJson(fileName: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
