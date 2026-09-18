export function now() {
  return new Date().toISOString();
}

export function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value).trim();
  const legacyTaipei = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s+|T)(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  const candidate = legacyTaipei
    ? `${legacyTaipei[1]}-${legacyTaipei[2].padStart(2, "0")}-${legacyTaipei[3].padStart(2, "0")}T${legacyTaipei[4].padStart(2, "0")}:${legacyTaipei[5]}:${legacyTaipei[6]}+08:00`
    : text;
  const timestamp = new Date(candidate);
  if (Number.isNaN(timestamp.getTime())) throw new Error(`Invalid stored timestamp: ${text}`);
  return timestamp.toISOString();
}
