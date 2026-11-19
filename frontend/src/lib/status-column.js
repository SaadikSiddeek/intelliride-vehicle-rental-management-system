import axiosClient from "@/axios-client";
import { toast } from "sonner";

/** DOM formatter keeps keyboard activation native and status unchanged until confirmed. */
export function statusColumn(resource, permitted) {
  return { title: "Status", field: "status", minWidth: 155, headerSort: false,
    formatter(cell) {
      const value = cell.getValue();
      const binary = [0, 1, "0", "1", true, false, "Active", "Inactive"].includes(value);
      const active = [1, "1", true, "Active"].includes(value);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "record-status-switch";
      button.setAttribute("role", "switch");
      button.setAttribute("aria-checked", String(active));
      button.setAttribute("aria-label", `${resource} status: ${binary ? active ? "Active" : "Inactive" : value}`);
      button.title = "Change status";
      const row = cell.getRow().getData();
      button.disabled = !permitted || !binary || row.user_type === "super_admin";
      const track = document.createElement("span"); track.className = "record-status-track"; track.setAttribute("aria-hidden", "true");
      const text = document.createElement("span"); text.textContent = binary ? active ? "Active" : "Inactive" : String(value);
      button.append(track, text);
      let pending = false;
      button.addEventListener("click", async event => {
        event.stopPropagation();
        if (pending || button.disabled) return;
        if (!window.confirm(`${active ? "Deactivate" : "Activate"} this ${resource} record? Existing history will be retained.`)) return;
        pending = true; button.disabled = true; button.setAttribute("aria-busy", "true"); text.textContent = "Saving…";
        try {
          const { data } = await axiosClient.post("/record_status", {resource, id: row.ID ?? row.id,
            active: !active, expected_status: String(value), reason: "Confirmed inline status change"});
          if (!data.status) throw new Error(data.message || "Unable to change status.");
          await cell.getRow().update({status: data.data.status});
          cell.getTable().refreshFilter();
          toast.success(data.message);
        } catch (error) {
          text.textContent = active ? "Active" : "Inactive";
          button.disabled = false; button.removeAttribute("aria-busy");
          toast.error(error.response?.data?.message || error.message || "Unable to change status.");
        } finally { pending = false; }
      });
      return button;
    }
  };
}
