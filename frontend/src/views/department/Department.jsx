import FieldError from "@/components/ErrorField";
/* =====================================================================
   TEMPLATE PAGE: Department Management (list table + create/edit drawer)

   HOW TO REUSE FOR ANOTHER FORM (Role, Designation, Branch ...)
   1. Copy this file and rename the component (Department -> Role).
   2. Change the field names in: defaultValues, every reset({...}),
      the <Input {...register("field_name")} /> lines, and the Tabulator columns.
   3. Change the API urls: /get_department, /save_department, /fetch_department_data.
   4. Change the texts (titles, labels, placeholders, messages).
   Everything else (error handling, save flow, edit flow) stays the same.
   ===================================================================== */

// ---------- IMPORTS ----------

// Our own search box component that filters the Tabulator table.
// We pass it the table ref so it can call table.setFilter(...) on it.
import TableSearch from "@/components/TableSearch";

// Icons from the "lucide-react" icon library (each icon is a React component).
// CircleAlert  -> small icon beside field error text
// Plus         -> icon on the "Add" button
// TriangleAlert-> icon on the general (non-field) error box
import { Plus, TriangleAlert } from "lucide-react";

// Our styled <input> component (from the UI folder, shadcn-style).
// It forwards "ref", which react-hook-form's register() needs to work.
import { Input } from "@/components/ui/input";

// Pre-configured axios instance (base URL, auth token headers, etc.).
// Use it instead of plain axios so every request is configured the same way.
import axiosClient from "@/axios-client";

// React built-in hooks:
//  useState  -> values that, when changed, re-render the screen
//  useRef    -> a box that holds a value WITHOUT causing re-render
//              (used for the DOM element and the Tabulator instance)
//  useEffect -> run code at certain moments (here: once when page opens)
import { useEffect, useRef, useState } from "react";

// react-hook-form: library that manages form values, validation and errors
// for us, so we don't need one useState / ref per input field.
import { useForm } from "react-hook-form";

// Tabulator: JS library that draws the data table (sorting, resizing, etc.).
// "TabulatorFull" is the build that includes all modules.
import { TabulatorFull as Tabulator } from "tabulator-tables";
// Tabulator's default stylesheet (required or the table looks broken).
import "tabulator-tables/dist/css/tabulator.min.css";

// Our own loading overlay (car animation) shown on top of an element.
import CarLoader from "@/components/CarLoader";
// Our own page title + breadcrumb header.
import PageHeader from "@/components/PageHeader";
// Our own slide-in side panel (drawer). The form lives inside it.
import CustomDrawer from "@/components/Drawer";

export default function Department() {
  // =====================================================================
  // 1) STATE (values that change and re-render the screen)
  // =====================================================================

  // true -> drawer is visible, false -> hidden
  const [openDrawer, setOpenDrawer] = useState(false);

  // true while the table data is loading from the server (shows CarLoader)
  const [tableLoading, setTableLoading] = useState(false);

  // true while the Save request is running (used to change the button text)
  const [saving, setSaving] = useState(false);

  // Error message that does NOT belong to a single field,
  // e.g. server crashed / network down. Shown in the red box at top of form.
  const [generalError, setGeneralError] = useState("");

  // Empty string  -> we are CREATING a new record
  // Has an ID     -> we are UPDATING that record
  // This one value decides the drawer title, button text, and payload.
  const [update_id, set_update_id] = useState("");

  // true while the edit data is being fetched.
  // NOTE: it is set but not used in the UI yet. You can use it to show a
  // spinner inside the drawer or to disable the Save button while loading.
  const [form_load, set_form_load] = useState(false);

  // =====================================================================
  // 2) REFS (do NOT cause re-render when changed)
  // =====================================================================

  // Points to the empty <div> where Tabulator draws the table.
  const tableRef = useRef(null);

  // Holds the Tabulator object itself (so we can call setData, destroy, ...).
  // Stored in a ref because it is not UI state and must survive re-renders.
  const table = useRef(null);

  // =====================================================================
  // 3) react-hook-form SETUP
  // =====================================================================
  const {
    // register("field") -> connects an input to the form (value + validation).
    register,

    // handleSubmit(fn) -> wraps our submit function. It first runs all
    // validation rules; only if everything is valid does it call fn(values).
    handleSubmit,

    // reset(values) -> sets ALL fields to the given values in one shot and
    // clears the "touched/dirty" state. Used for clear form and fill form.
    reset,

    // setError(field, {...}) -> manually show an error on a field.
    // We use it to show errors that come from the backend (Laravel 422).
    setError,

    // clearErrors() -> remove all error messages currently shown.
    clearErrors,

    // formState.errors -> object with the current error of each field.
    // Example: errors.department_name.message
    formState: { errors },
  } = useForm({
    // Starting values of the form. Keys MUST match the register("...") names.
    defaultValues: {
      department_name: "",
      status: true, // checkbox: true = Active
    },
  });

  // =====================================================================
  // 4) OPEN DRAWER IN "CREATE" MODE
  // =====================================================================
  const open_create_drawer = () => {
    // Empty all fields (so old edit data is not left behind)
    reset({
      department_name: "",
      status: true,
    });
    clearErrors(); // remove old red error messages
    set_update_id(""); // no ID -> create mode
    setGeneralError(""); // remove old general error box
    setOpenDrawer(true); // show the drawer
  };

  // =====================================================================
  // 5) LOAD TABLE DATA FROM SERVER
  // =====================================================================
  const get_department = () => {
    setTableLoading(true); // show the loader

    axiosClient
      .post("/get_department")
      // axios wraps the response; { data } picks response.data (the JSON body).
      // Our API returns { data: [ ...rows ] }, so we use data.data.
      .then(({ data }) => {
        // "?." means: only call setData if table.current exists (safe call).
        table.current?.setData(data.data);
      })
      .catch(() => {
        console.log("Failed loading departments");
      })
      // finally runs on success AND on error, so the loader always stops.
      .finally(() => {
        setTableLoading(false);
      });
  };

  // =====================================================================
  // 6) SAVE (used for both Create and Update)
  // =====================================================================
  // handleSubmit calls this ONLY if validation passed.
  // "form_data" is an object of all registered fields, e.g.
  // { department_name: "HR", status: true }
  const onSubmit = (form_data) => {
    setGeneralError(""); // clear old error
    setSaving(true); // button shows "Saving..."

    // Build what we send to the backend.
    const payload = {
      form_data: {
        ...form_data, // copy all fields
        // The checkbox gives true/false, but the DB wants 1/0,
        // so we overwrite "status" with the converted value.
        status: form_data.status ? 1 : 0,
      },
    };

    // If we are editing, also send which record to update.
    if (update_id) {
      payload.upd_id = update_id;
    }

    axiosClient
      .post("/save_department", payload)
      .then(() => {
        // Success: clear the form, leave edit mode, close drawer, refresh table
        reset({
          department_name: "",
          status: true,
        });

        set_update_id("");
        setOpenDrawer(false);
        get_department();
      })
      .catch((err) => {
        // 422 = Laravel validation failed. The body looks like:
        // { errors: { department_name: ["The department name is required."] } }
        if (err.response && err.response.status === 422) {
          const server_errors = err.response.data.errors || {};

          // Loop over every field that has an error and push it
          // into react-hook-form, so it shows under the right input.
          Object.keys(server_errors).forEach((field) => {
            setError(field, {
              type: "server", // just a label to know it came from the server
              message: server_errors[field][0], // show the first message
            });
          });
        } else {
          // Any other problem (500, no internet, ...) -> general red box.
          setGeneralError("Something went wrong. Please try again.");
        }
      })
      .finally(() => {
        setSaving(false); // always re-enable the button
      });
  };

  // =====================================================================
  // 7) FETCH ONE RECORD AND FILL THE FORM (Edit mode)
  // =====================================================================
  const fetch_department_data = (id) => {
    set_form_load(true);
    clearErrors();
    setGeneralError("");
    setOpenDrawer(true); // open the drawer first, data fills in after

    axiosClient
      .post("/fetch_department_data", {
        upd_id: id,
      })
      .then(({ data }) => {
        // Remember the ID -> this switches the drawer to "Update" mode.
        // (Make sure your API returns this key with the same casing: "ID".)
        set_update_id(data.data.ID);

        // reset() fills EVERY field in one call. No refs, no timing issues.
        // "|| ''" avoids null values going into text inputs.
        // "status == 1" converts DB number 1/0 into checkbox true/false.
        reset({
          department_name: data.data.department_name || "",
          status: data.data.status == 1,
        });
      })
      .catch(() => {
        console.log("Failed fetching department data");
      })
      .finally(() => {
        set_form_load(false);
      });
  };

  // =====================================================================
  // 8) CREATE THE TABLE (runs ONE time when the page opens)
  // =====================================================================
  // useEffect(fn, []) -> the empty [] means "run only once after first render".
  useEffect(() => {
    // Create the Tabulator table inside our <div ref={tableRef}>.
    table.current = new Tabulator(tableRef.current, {
      layout: "fitColumns", // columns stretch to fill the width
      maxHeight: "550px", // table scrolls after this height
      placeholder: '<div class="ir-table-empty"><strong>No Departments Found</strong><p>Add a record using the create button, or clear your search to see more results.</p></div>', // text when there are no rows
      movableColumns: true, // user can drag columns to reorder
      columnHeaderVertAlign: "middle",

      // One object per column.
      columns: [
        {
          title: "Department Name", // header text
          field: "department_name", // key in each row's data
          frozen: true, // stays fixed while scrolling sideways
          widthGrow: 2, // takes 2x space compared to a widthGrow:1 column
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 140,
          // formatter = custom HTML for the cell.
          // Here we show a green "Active" or red "Deactive" badge.
          formatter: function (cell) {
            let value = cell.getValue();
            if (value == 1) {
              return `<span class="inline-flex items-center rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">Active</span>`;
            }
            return `<span class="inline-flex items-center rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">Deactive</span>`;
          },
        },
        {
          title: "Actions",
          field: "id", // the row's id column (used in cellClick below)
          hozAlign: "center",
          vertAlign: "middle",
          width: 120,
          headerSort: false, // no sorting for the action column
          // Draws the edit icon button inside the cell.
          formatter: function () {
            return `
                <div class="flex items-center justify-center w-full">
                    <button aria-label="Edit record" title="Edit record" class="table-action-btn" id="edit-department">
                        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m16 3 5 5M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-5-5Z"/></svg>
                    </button>
                </div>
            `;
          },
          // Runs when the user clicks this cell:
          // get the row's id, then load that record into the form.
          cellClick: function (e, cell) {
            let id = cell.getRow().getData().id;
            fetch_department_data(id);
          },
        },
      ],
    });

    // Load the rows right after the table is created.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the existing initial API request and loading state.
    get_department();

    // CLEANUP: the function returned from useEffect runs when the page is
    // left (unmounted). We destroy the table so it doesn't leak memory.
    return () => {
      table.current?.destroy();
    };
  }, []);

  // =====================================================================
  // 9) SMALL COMPONENT: shows the error text under an input
  // =====================================================================
  // Usage: <FieldError errors={errors} name="department_name" />
  // It reads errors[name] from react-hook-form. Both our own "required"
  // messages and the server (setError) messages appear through this.

  // =====================================================================
  // 10) THE SCREEN (JSX)
  // =====================================================================
  return (
    // <> </> is a Fragment: a wrapper that adds no extra HTML element.
    <>
      {/* Page title and breadcrumb */}
      <PageHeader
        title="Department Management"
        sub_text="Create, manage and maintain company departments."
        breadcrumbs={[
          { label: "Department" },
          { label: "Department Management" },
        ]}
      />

      <div className="management-page">
        <div className="page-container">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* "Add" button -> opens the drawer in create mode */}
            <button
              className="btn-primary management-add"
              onClick={open_create_drawer}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Department
            </button>

            {/* ---------------- DRAWER WITH THE FORM ---------------- */}
            <CustomDrawer
              saving={saving || form_load}
              open={openDrawer} // show / hide
              setOpen={setOpenDrawer} // lets the drawer close itself (X / overlay click)
              // Title and button text change depending on create vs update.
              // update_id has a value -> update mode.
              title={update_id ? "Update Department" : "Create Department"}
              description="Add or update a company department"
              // Nested ternary: while saving show "Saving...", otherwise the normal label.
              submitText={
                saving
                  ? update_id
                    ? "Updating..."
                    : "Saving..."
                  : update_id
                    ? "Update Department"
                    : "Save Department"
              }
              // The drawer's footer Save button is OUTSIDE the <form> tag,
              // so we hand it the submit function directly.
              // handleSubmit(onSubmit) = validate first, then call onSubmit.
              onSubmit={(event) => handleSubmit(onSubmit)(event)}
              size="max-w-xl"
            >
              {/* General error box: only visible when generalError has text.
                  "cond && <jsx/>" means: render the jsx only if cond is truthy. */}
              {generalError && (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-[var(--danger-soft)] px-4 py-3">
                  <TriangleAlert
                    size={16}
                    aria-hidden="true"
                    className="text-red-500 mt-0.5"
                  />
                  <p className="text-sm text-destructive font-medium">
                    {generalError}
                  </p>
                </div>
              )}

              {/* Same handleSubmit here, so pressing ENTER inside an
                  input also submits the form with validation. */}
              <form aria-busy={form_load} onSubmit={(event) => handleSubmit(onSubmit)(event)}>
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Department Name
                    </label>

                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        {/* TEXT INPUT
                            aria-invalid={!!errors.department_name} aria-describedby={errors.department_name ? "department_name-error" : undefined}
                      {...register("department_name", {rules})} spreads
                            name, onChange, onBlur and ref onto the input.
                            That is how react-hook-form reads its value.
                            "required: 'message'" -> blocks submit when empty
                            and shows that message. */}
                        <Input
                          aria-label="Department name"
                          type="text"
                          placeholder="Enter department name"
                          // Add red border classes only when this field has an error
                          className={`custom-input-sm w-full ${errors.department_name ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                          aria-invalid={!!errors.department_name} aria-describedby={errors.department_name ? "department_name-error" : undefined}
                      {...register("department_name", {
                            required: "Department name is required",
                          })}
                        />
                        {/* Error text under the input */}
                        <FieldError errors={errors} name="department_name" />
                      </div>

                      {/* TOGGLE SWITCH (a hidden checkbox + styled divs)
                          - "sr-only" hides the real checkbox visually.
                          - "peer" lets the sibling divs react to its state:
                            peer-checked:bg-primary -> background turns on
                            peer-checked:translate-x-5 -> the knob slides right
                          - register("status") gives true/false automatically
                            for a checkbox. */}
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                        <Input
                          aria-label="Status"
                          type="checkbox"
                          className="sr-only peer"
                          {...register("status")}
                        />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors"></div>
                        <div className="absolute left-1 top-1 h-4 w-4 bg-card rounded-full transition-transform peer-checked:translate-x-5"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            </CustomDrawer>

            {/* ---------------- TABLE CARD ---------------- */}
            <div className="xl:col-span-12">
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-6 py-5 border-b bg-card">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Department List
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage company departments.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[var(--info-soft)] text-primary text-sm font-medium">
                    Departments
                  </span>
                </div>

                {/* This div's id must match CarLoader's targetId below,
                    so the loader overlay covers exactly this area. */}
                <div id="department-tb" className="p-6">
                  {/* Search box that filters the table */}
                  <TableSearch table={table} />

                  {/* Tabulator draws the table inside this empty div.
                      ref={tableRef} is how useEffect finds it. */}
                  <div
                    ref={tableRef}
                    className="rounded-xl border border-border overflow-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay on top of the table while tableLoading is true */}
      <CarLoader
        targetId="department-tb"
        show={tableLoading}
        text="Loading Departments"
      />
    </>
  );
}
