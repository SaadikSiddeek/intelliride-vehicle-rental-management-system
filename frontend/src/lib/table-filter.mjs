// Shared presentation filter for fully loaded master-data tables.
export function matchesTableRecord(row, { status = "all", query = "", fields } = {}) {
  const value = String(row.status ?? "").toLowerCase();
  const active = ["1", "true", "active"].includes(value);
  const inactive = ["0", "false", "inactive"].includes(value);
  if (status === "active" && !active) return false;
  if (status === "inactive" && !inactive) return false;
  const search = query.trim().toLocaleLowerCase();
  return !search || (fields || Object.keys(row)).some(field => {
    const cell = row[field];
    return cell != null && typeof cell !== "object" && String(cell).toLocaleLowerCase().includes(search);
  });
}
