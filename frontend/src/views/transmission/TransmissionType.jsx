import { useForm, useWatch } from "react-hook-form";
import TableSearch from "@/components/TableSearch";
import { Plus } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import { useEffect, useRef, useState } from "react";

import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import CustomDrawer from "@/components/Drawer";

export default function TransmissionType() {

    const { register, handleSubmit, reset, control, formState: { errors } } = useForm({ defaultValues: {"transmission_name": "", "description": "", "status": true} });
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
            transmission_name: form_data.transmission_name,
            description: form_data.description,
            status: form_data.status
        };

        console.log(payload);
        setDemoSubmitted(true);

    };

    useEffect(() => {

        table.current = new Tabulator(tableRef.current, {

            layout: "fitColumns",
            maxHeight: "550px",
            placeholder: '<div class="ir-table-empty"><strong>No Transmission Types Found</strong><p>Add a record using the create button, or clear your search to see more results.</p></div>',
            movableColumns: true,
            columnHeaderVertAlign: "middle",

            // Dummy Data
            data: [
                {
                    id: 1,
                    transmission_name: "Automatic",
                    description: "Transmission system that changes gears automatically without manual input.",
                    status: 1
                },
                {
                    id: 2,
                    transmission_name: "Manual",
                    description: "Transmission system where the driver manually changes gears.",
                    status: 1
                },
                {
                    id: 3,
                    transmission_name: "CVT",
                    description: "Continuously Variable Transmission providing smooth gear transitions.",
                    status: 1
                },
                {
                    id: 4,
                    transmission_name: "Semi Automatic",
                    description: "Combination of automatic operation with manual gear control options.",
                    status: 0
                },
                {
                    id: 5,
                    transmission_name: "Dual Clutch (DCT)",
                    description: "Advanced transmission system offering faster gear shifting performance.",
                    status: 1
                }
            ],

            columns: [
                {
                    title: "Transmission Name",
                    field: "transmission_name",
                    frozen: true,
                    width: 200
                },
                {
                    title: "Description",
                    field: "description",
                    widthGrow: 2
                },
                {
                    title: "Status",
                    field: "status",
                    hozAlign: "center",
                    width: 130,
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
                    }
                }
            ]

        });

        return () => {
            table.current?.destroy();
        };

    }, []);

    return (

        <>
            <PageHeader
                title="Transmission Type Management"
                sub_text="Create, manage and maintain vehicle transmission types."
                breadcrumbs={[
                    { label: "Transmission Type" },
                    { label: "Transmission Type Management" }
                ]}
            />

            <div className="management-page">
                <div className="page-container">
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                        <button
                            className="btn-primary management-add"
                            onClick={() => { reset_form(); setOpenDrawer(true); }}
                        >
                            <Plus size={16} aria-hidden="true" className="mr-2"/>
                            Add Transmission Type
                        </button>

                        <CustomDrawer
                            open={openDrawer}
                            setOpen={setOpenDrawer}
                            title="Create Transmission Type"
                            description="Add a new vehicle transmission type"
                            submitText="Save Transmission Type"
                            onSubmit={handleSubmit(save_data)}
                            size="max-w-2xl"
                        >
                            <form onSubmit={handleSubmit(save_data)} noValidate>
                                <p className="form-hint">Sample workspace. You can explore and validate this form; saving records is not connected in this module.</p>
                                {demoSubmitted && <p className="demo-submit-note" role="status">Form validated. This preview does not save a record.</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Transmission Name
                                        </label>
                                        <Input aria-label="Transmission Name"
                                            {...register("transmission_name", { required: "This field is required." })} error={errors.transmission_name?.message}
                                            type="text"
                                            placeholder="Enter transmission name"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Description
                                        </label>
                                        <Textarea aria-label="Description"
                                            {...register("description")} error={errors.description?.message}
                                            rows="4"
                                            placeholder="Enter description"
                                            className="custom-input-sm resize-none"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-foreground mb-3">
                                            Status
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <Input aria-label="Status"
                                                    {...register("status")} error={errors.status?.message}
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
                                            Transmission Type List
                                        </h2>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Manage available transmission types.
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-[var(--info-soft)] text-primary text-sm font-medium">
                                        Transmission
                                    </span>
                                </div>

                                <div className="p-6">
                                    <TableSearch table={table}/>
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