import { useForm, useWatch } from "react-hook-form";
import TableSearch from "@/components/TableSearch";
import { Plus } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import PageHeader from "../../components/PageHeader";
import { useEffect, useRef, useState } from "react";

import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import CustomDrawer from "../../components/Drawer";

export default function Branch() {

    const { register, handleSubmit, reset, control, formState: { errors } } = useForm({ defaultValues: {"branch_name": "", "branch_code": "", "address": "", "contact_number": "", "manager": "", "status": true} });
    const [demoSubmitted, setDemoSubmitted] = useState(false);

    const [openDrawer, setOpenDrawer] = useState(false);

    const tableRef = useRef(null);
    const table = useRef(null);

    const [, setTableLoading] = useState(false);
    const status = useWatch({ control, name: "status" });

    // Form Refs

    const reset_form = () => {
        reset();
        setDemoSubmitted(false);
    };

    const save_data = (form_data) => {

        const payload = {
            branch_name: form_data.branch_name,
            branch_code: form_data.branch_code,
            address: form_data.address,
            contact_number: form_data.contact_number,
            manager: form_data.manager,
            status: form_data.status
        };

        console.log(payload);
        setDemoSubmitted(true);
    };

    // eslint-disable-next-line no-unused-vars -- Original unconnected loading stub retained.
    const get_branch = () => {
        setTableLoading(true);
    };

    useEffect(() => {

        table.current = new Tabulator(tableRef.current, {
            layout: "fitColumns",
            maxHeight: "550px",
            placeholder: '<div class="ir-table-empty"><strong>No Branches Found</strong><p>Add a record using the create button, or clear your search to see more results.</p></div>',
            movableColumns: true,
            columnHeaderVertAlign: "middle",

            data: [
                {
                    id: 1,
                    branch_name: "Colombo Main Branch",
                    branch_code: "COL001",
                    address: "No 25, Galle Road, Colombo",
                    contact_number: "0771234567",
                    manager: "Ahmed Perera",
                    status: 1
                },
                {
                    id: 2,
                    branch_name: "Kandy Branch",
                    branch_code: "KAN001",
                    address: "No 45, Dalada Veediya, Kandy",
                    contact_number: "0812234567",
                    manager: "Ahamed Saadik",
                    status: 1
                },
                {
                    id: 3,
                    branch_name: "Galle Branch",
                    branch_code: "GAL001",
                    address: "No 10, Main Street, Galle",
                    contact_number: "0913345678",
                    manager: "Kasun Silva",
                    status: 0
                },
                {
                    id: 4,
                    branch_name: "Kurunegala Branch",
                    branch_code: "KUR001",
                    address: "No 18, Negombo Road, Kurunegala",
                    contact_number: "0374456789",
                    manager: "Nimal Fernando",
                    status: 1
                }
            ],

            columns: [
                { title: "Branch Name", field: "branch_name", frozen: true, width: 160 },
                { title: "Code", field: "branch_code", width: 90, frozen: true },
                { title: "Address", field: "address", widthGrow: 2 },
                { title: "Contact Number", field: "contact_number", width: 130 },
                { title: "Manager", field: "manager", width: 140 },
                {
                    title: "Status",
                    field: "status",
                    hozAlign: "center",
                    width: 120,
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
                    width: 100,
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
                title="Branch Management"
                sub_text="Create, manage and maintain company branches."
                breadcrumbs={[
                    { label: "Branch" },
                    { label: "Branch Management" }
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
                            Add Branch
                        </button>

                        <CustomDrawer
                            open={openDrawer}
                            setOpen={setOpenDrawer}
                            title="Create Branch"
                            description="Add a new branch location"
                            submitText="Save Branch"
                            onSubmit={handleSubmit(save_data)}
                            size="max-w-3xl"
                        >
                            <form onSubmit={handleSubmit(save_data)} noValidate>
                                <p className="form-hint">Sample workspace. You can explore and validate this form; saving records is not connected in this module.</p>
                                {demoSubmitted && <p className="demo-submit-note" role="status">Form validated. This preview does not save a record.</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Branch Name
                                        </label>
                                        <Input aria-label="Branch Name"
                                            {...register("branch_name", { required: "This field is required." })} error={errors.branch_name?.message}
                                            type="text"
                                            placeholder="Enter branch name"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Branch Code
                                        </label>
                                        <Input aria-label="Branch Code"
                                            {...register("branch_code")} error={errors.branch_code?.message}
                                            type="text"
                                            placeholder="Enter branch code"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Manager
                                        </label>
                                        <Input aria-label="Manager"
                                            {...register("manager")} error={errors.manager?.message}
                                            type="text"
                                            placeholder="Enter manager name"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Contact Number
                                        </label>
                                        <Input aria-label="Contact Number"
                                            {...register("contact_number")} error={errors.contact_number?.message}
                                            type="text"
                                            placeholder="Enter contact number"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Address
                                        </label>
                                        <Textarea aria-label="Address"
                                            {...register("address")} error={errors.address?.message}
                                            rows="3"
                                            placeholder="Enter branch address"
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
                                            Branch List
                                        </h2>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Manage company branches and locations.
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-[var(--info-soft)] text-primary text-sm font-medium">
                                        Branches
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