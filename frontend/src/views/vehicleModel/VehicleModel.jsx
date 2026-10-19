import { useForm, useWatch } from "react-hook-form";
import TableSearch from "@/components/TableSearch";
import { Plus } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import { useEffect, useRef, useState } from "react";

import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import CustomDrawer from "@/components/Drawer";

export default function VehicleModel() {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      brand: "",
      model_name: "",
      year: "",
      engine_capacity: "",
      fuel_type: "",
      transmission: "",
      status: true,
    },
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const [openDrawer, setOpenDrawer] = useState(false);

  const tableRef = useRef(null);
  const table = useRef(null);

  // Form Refs

  const status = useWatch({ control, name: "status" });

  const reset_form = () => {
    reset();
    setDemoSubmitted(false);
  };

  const save_data = (form_data) => {
    const payload = {
      brand: form_data.brand,
      model_name: form_data.model_name,
      year: form_data.year,
      engine_capacity: form_data.engine_capacity,
      fuel_type: form_data.fuel_type,
      transmission: form_data.transmission,
      status: form_data.status,
    };

    console.log(payload);
    setDemoSubmitted(true);
  };

  useEffect(() => {
    table.current = new Tabulator(tableRef.current, {
      layout: "fitColumns",
      maxHeight: "550px",
      placeholder:
        '<div class="ir-table-empty"><strong>No Vehicle Models Found</strong><p>Add a record using the create button, or clear your search to see more results.</p></div>',
      movableColumns: true,
      columnHeaderVertAlign: "middle",

      // Dummy Data
      data: [
        {
          id: 1,
          brand: "Toyota",
          model_name: "Prius",
          year: 2022,
          engine_capacity: "1800cc",
          fuel_type: "Hybrid",
          transmission: "Automatic",
          status: 1,
        },
        {
          id: 2,
          brand: "Honda",
          model_name: "Vezel",
          year: 2021,
          engine_capacity: "1500cc",
          fuel_type: "Hybrid",
          transmission: "Automatic",
          status: 1,
        },
        {
          id: 3,
          brand: "Suzuki",
          model_name: "Wagon R",
          year: 2020,
          engine_capacity: "660cc",
          fuel_type: "Petrol",
          transmission: "Automatic",
          status: 1,
        },
        {
          id: 4,
          brand: "BMW",
          model_name: "320i",
          year: 2023,
          engine_capacity: "2000cc",
          fuel_type: "Petrol",
          transmission: "Automatic",
          status: 0,
        },
        {
          id: 5,
          brand: "Nissan",
          model_name: "X-Trail",
          year: 2022,
          engine_capacity: "2500cc",
          fuel_type: "Petrol",
          transmission: "Automatic",
          status: 1,
        },
      ],

      columns: [
        {
          title: "Brand",
          field: "brand",
          frozen: true,
          width: 120,
        },
        {
          title: "Model Name",
          field: "model_name",
          frozen: true,
          width: 140,
        },
        {
          title: "Year",
          field: "year",
          width: 80,
          hozAlign: "center",
        },
        {
          title: "Engine Capacity",
          field: "engine_capacity",
          width: 130,
        },
        {
          title: "Fuel Type",
          field: "fuel_type",
          width: 100,
        },
        {
          title: "Transmission",
          field: "transmission",
          width: 120,
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 120,

          formatter: function (cell) {
            let value = cell.getValue();

            if (value == 1) {
              return `
                <span class="inline-flex items-center rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">
                    Active
                </span>
            `;
            }

            return `
            <span class="inline-flex items-center rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">
                Deactive
            </span>
        `;
          },
        },
        {
          title: "Actions",
          field: "id",
          hozAlign: "center",
          width: 110,
          headerSort: false,

          formatter: function () {
            return `
                        <div class="flex items-center justify-center">
                            <button aria-label="Edit record" title="Edit record" class="table-action-btn">
                                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m16 3 5 5M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-5-5Z"/></svg>
                            </button>
                        </div>
                        `;
          },
        },
      ],
    });

    return () => {
      table.current?.destroy();
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Vehicle Model Management"
        sub_text="Create, manage and maintain vehicle models."
        breadcrumbs={[
          { label: "Vehicle Model" },
          { label: "Vehicle Model Management" },
        ]}
      />

      <div className="management-page">
        <div className="page-container">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <button
              className="btn-primary management-add"
              onClick={() => {
                reset_form();
                setOpenDrawer(true);
              }}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Vehicle Model
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={setOpenDrawer}
              title="Create Vehicle Model"
              description="Add a new vehicle model"
              submitText="Save Model"
              onSubmit={handleSubmit(save_data)}
              size="max-w-3xl"
            >
              <form onSubmit={handleSubmit(save_data)} noValidate>
                <p className="form-hint">
                  Sample workspace. You can explore and validate this form;
                  saving records is not connected in this module.
                </p>
                {demoSubmitted && (
                  <p className="demo-submit-note" role="status">
                    Form validated. This preview does not save a record.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Brand
                    </label>
                    <NativeSelect
                      aria-label="Brand"
                      {...register("brand")}
                      error={errors.brand?.message}
                      className="custom-input-sm"
                    >
                      <option value="">Select Brand</option>
                    </NativeSelect>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Model Name
                    </label>
                    <Input
                      aria-label="Model Name"
                      {...register("model_name", {
                        required: "This field is required.",
                      })}
                      error={errors.model_name?.message}
                      type="text"
                      placeholder="Enter model name"
                      className="custom-input-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Year
                    </label>
                    <Input
                      aria-label="Year"
                      {...register("year")}
                      error={errors.year?.message}
                      type="number"
                      placeholder="Enter manufacturing year"
                      className="custom-input-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Engine Capacity
                    </label>
                    <Input
                      aria-label="Engine Capacity"
                      {...register("engine_capacity")}
                      error={errors.engine_capacity?.message}
                      type="text"
                      placeholder="Eg: 1500cc"
                      className="custom-input-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Fuel Type
                    </label>
                    <NativeSelect
                      aria-label="Fuel Type"
                      {...register("fuel_type")}
                      error={errors.fuel_type?.message}
                      className="custom-input-sm"
                    >
                      <option value="">Select Fuel Type</option>
                      <option>Petrol</option>
                      <option>Diesel</option>
                      <option>Hybrid</option>
                      <option>Electric</option>
                    </NativeSelect>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Transmission
                    </label>
                    <NativeSelect
                      aria-label="Transmission"
                      {...register("transmission")}
                      error={errors.transmission?.message}
                      className="custom-input-sm"
                    >
                      <option value="">Select Transmission</option>
                      <option>Automatic</option>
                      <option>Manual</option>
                    </NativeSelect>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Status
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <Input
                          aria-label="Status"
                          {...register("status")}
                          error={errors.status?.message}
                          type="checkbox"
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                      <span className="text-sm text-muted-foreground">
                        {status ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              </form>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Vehicle Model List
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage available vehicle models.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[var(--info-soft)] text-primary text-sm font-medium">
                    Models
                  </span>
                </div>

                <div className="p-6">
                  <TableSearch table={table} />
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
    </>
  );
}
