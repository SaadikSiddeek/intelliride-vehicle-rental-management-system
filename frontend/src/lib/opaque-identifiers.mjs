const identities = new Map();
export function isOpaqueIdentifier(value) { return typeof value === "string" && /^ir1\.[a-f0-9]{32}\.[A-Za-z0-9_-]+$/.test(value); }
export function stableIdentifier(value) {
  if (!isOpaqueIdentifier(value)) return value;
  const key = value.split(".").slice(0, 2).join(".");
  if (!identities.has(key)) identities.set(key, value);
  return identities.get(key);
}
export function normalizeIdentifiers(value) {
  if (Array.isArray(value)) return value.map(normalizeIdentifiers);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeIdentifiers(item)]));
  return stableIdentifier(value);
}
