import { useState } from "react";
import { Search, X } from "lucide-react";
/** Client-side presentation filter. Existing requests and table records are untouched. */
export default function TableSearch({ table }) {
  const [query, setQuery] = useState("");
  const update = (value) => {
    setQuery(value);
    const instance = table.current;
    if (!instance) return;
    const search = value.trim().toLocaleLowerCase();
    if (!search) {
      instance.clearFilter();
      return;
    }
    const fields = instance
      .getColumns()
      .map((col) => col.getField())
      .filter(Boolean);
    instance.setFilter((row) =>
      fields.some((field) => {
        const value = row[field];
        return (
          value !== null &&
          value !== undefined &&
          typeof value !== "object" &&
          String(value).toLocaleLowerCase().includes(search)
        );
      }),
    );
  };
  return (
    <div className="table-toolbar">
      <div className="record-search">
        <Search size={16} />
        <input
          aria-label="Search table records"
          type="search"
          placeholder="Search records…"
          value={query}
          onChange={(e) => update(e.target.value)}
        />
        {query && (
          <button
            type="button"
            onClick={() => update("")}
            title="Clear search"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <span>Click a column heading to sort</span>
    </div>
  );
}
