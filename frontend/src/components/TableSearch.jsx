import { useState } from "react";
import { NativeSelect } from "@/components/ui/input";
import { matchesTableRecord } from "@/lib/table-filter.mjs";
import { Search, X } from "lucide-react";
/** Client-side presentation filter. Existing requests and table records are untouched. */
export default function TableSearch({ table, filters }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(filters ? "active" : "all");
  const update = (value, selectedStatus = status) => {
    setQuery(value);
    const instance = table.current;
    const fields = (instance?.getColumns() || [])
      .map((col) => col.getField())
      .filter(Boolean);
    const next = { query: value, status: selectedStatus, fields };
    if (filters) Object.assign(filters.current, next);
    if (instance) instance.setFilter(matchesTableRecord, next);
    // Tabulator resets local pagination as part of its filtering pipeline.
  };
  return (
    <div className="table-toolbar flex-wrap">
      {filters && <label className="flex items-center gap-2 text-sm">Status<NativeSelect aria-label="Record status" value={status} onChange={event => { setStatus(event.target.value); update(query, event.target.value); }}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></NativeSelect></label>}
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
