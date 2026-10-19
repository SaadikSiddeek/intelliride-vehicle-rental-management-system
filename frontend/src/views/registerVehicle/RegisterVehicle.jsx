import { useForm } from "react-hook-form";
import TableSearch from "@/components/TableSearch";
import { Input, NativeSelect } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import { useEffect, useRef, useState } from "react";

import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import CustomDrawer from "@/components/Drawer";


export default function VehicleRegistration() {

    const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: {"number_plate": "", "manufacture_year": "", "color": "", "engine_number": "", "chassis_number": "", "mileage": "", "seating_capacity": "", "purchase_date": "", "purchase_price": "", "daily_rental_rate": "", "weekly_rental_rate": "", "monthly_rental_rate": "", "insurance_expiry_date": "", "registration_expiry_date": "", "images": null, "category": "", "brand": "", "model": "", "fuel_type": "", "transmission": "", "vehicle_status": ""} });
    const [demoSubmitted, setDemoSubmitted] = useState(false);

    const [openDrawer, setOpenDrawer] = useState(false);


    const tableRef = useRef(null);
    const table = useRef(null);


    // React Hook Form retains the original payload field names and string values.


    // Uploaded image previews are presentation state.
    const [imagePreviews, setImagePreviews] = useState([]);


    // Dropdown options (wire these up to your API data later)
    const categoryOptions = ["Car", "Van", "SUV", "Bus", "Motorcycle", "Truck"];
    const brandOptions = ["Toyota", "Honda", "Nissan", "Suzuki", "Mitsubishi", "BMW"];
    const modelOptions = ["Corolla", "Civic", "Aqua", "Vezel", "Swift", "Alto"];
    const fuelTypeOptions = ["Petrol", "Diesel", "Hybrid", "Electric"];
    const transmissionOptions = ["Automatic", "Manual", "Tiptronic", "CVT"];
    const vehicleStatusOptions = ["Available", "Rented", "Under Maintenance", "Out of Service"];


    const resetForm = () => {
        reset();
        setDemoSubmitted(false);
        setImagePreviews([]);
    };


    useEffect(() => () => imagePreviews.forEach(url => URL.revokeObjectURL(url)), [imagePreviews]);

    const handle_image_change = (e) => {

        const files = Array.from(e.target.files);


        const previews = files.map((file) => URL.createObjectURL(file));

        setImagePreviews(previews);

    };


    const save_data = (form_data) => {


        const formData = new FormData();

        formData.append("number_plate", form_data.number_plate);
        formData.append("category", form_data.category);
        formData.append("brand", form_data.brand);
        formData.append("model", form_data.model);
        formData.append("manufacture_year", form_data.manufacture_year);
        formData.append("color", form_data.color);
        formData.append("fuel_type", form_data.fuel_type);
        formData.append("transmission", form_data.transmission);
        formData.append("engine_number", form_data.engine_number);
        formData.append("chassis_number", form_data.chassis_number);
        formData.append("mileage", form_data.mileage);
        formData.append("seating_capacity", form_data.seating_capacity);
        formData.append("purchase_date", form_data.purchase_date);
        formData.append("purchase_price", form_data.purchase_price);
        formData.append("daily_rental_rate", form_data.daily_rental_rate);
        formData.append("weekly_rental_rate", form_data.weekly_rental_rate);
        formData.append("monthly_rental_rate", form_data.monthly_rental_rate);
        formData.append("insurance_expiry_date", form_data.insurance_expiry_date);
        formData.append("registration_expiry_date", form_data.registration_expiry_date);
        formData.append("vehicle_status", form_data.vehicle_status);

        Array.from(form_data.images || []).forEach((file) => {
            formData.append("images[]", file);
        });

        for (let pair of formData.entries()) {
            console.log(pair[0], pair[1]);
        }

        setDemoSubmitted(true);

        // Example:
        // axios.post("/api/vehicle-registration", formData, {
        //     headers: { "Content-Type": "multipart/form-data" }
        // });

    };




    useEffect(() => {


        table.current = new Tabulator(tableRef.current, {


            layout: "fitColumns",
            maxHeight: "550px",
            placeholder: '<div class="ir-table-empty"><strong>No Vehicles Found</strong><p>Add a record using the create button, or clear your search to see more results.</p></div>',
            movableColumns: true,
            columnHeaderVertAlign: "middle",

            data: [

                {
                    id: 1,
                    number_plate: "CAB-1234",
                    brand: "Toyota",
                    model: "Corolla",
                    category: "Sedan",
                    fuel_type: "Petrol",
                    daily_rental_rate: 6000,
                    status: "Available"
                },

                {
                    id: 2,
                    number_plate: "KDH-5678",
                    brand: "Honda",
                    model: "Vezel",
                    category: "SUV",
                    fuel_type: "Hybrid",
                    daily_rental_rate: 8500,
                    status: "Rented"
                },

                {
                    id: 3,
                    number_plate: "NA-9087",
                    brand: "Nissan",
                    model: "Aqua",
                    category: "Car",
                    fuel_type: "Hybrid",
                    daily_rental_rate: 7000,
                    status: "Available"
                },

                {
                    id: 4,
                    number_plate: "WP-CAB-7788",
                    brand: "Suzuki",
                    model: "Swift",
                    category: "Hatchback",
                    fuel_type: "Petrol",
                    daily_rental_rate: 5000,
                    status: "Under Maintenance"
                },

                {
                    id: 5,
                    number_plate: "CP-LK-4455",
                    brand: "Mitsubishi",
                    model: "Outlander",
                    category: "SUV",
                    fuel_type: "Diesel",
                    daily_rental_rate: 12000,
                    status: "Available"
                },

                {
                    id: 6,
                    number_plate: "CAR-3322",
                    brand: "BMW",
                    model: "320i",
                    category: "Luxury Car",
                    fuel_type: "Petrol",
                    daily_rental_rate: 25000,
                    status: "Rented"
                },

                {
                    id: 7,
                    number_plate: "TRK-8899",
                    brand: "Toyota",
                    model: "Hilux",
                    category: "Pickup Truck",
                    fuel_type: "Diesel",
                    daily_rental_rate: 15000,
                    status: "Out of Service"
                }

            ],


            columns: [

                {
                    title: "Number Plate",
                    field: "number_plate",
                    frozen: true,
                    width: 150
                },
                {
                    title: "Brand",
                    field: "brand",
                    width: 120
                },
                {
                    title: "Model",
                    field: "model",
                    width: 120
                },
                {
                    title: "Category",
                    field: "category",
                    width: 110
                },
                {
                    title: "Fuel Type",
                    field: "fuel_type",
                    hozAlign: "center",
                    width: 110
                },
                {
                    title: "Daily Rate",
                    field: "daily_rental_rate",
                    hozAlign: "right",
                    width: 110,

                    formatter: function (cell) {
                        let value = cell.getValue();
                        return value ? `Rs. ${value}` : "-";
                    }
                },
                {
                    title: "Status",
                    field: "status",
                    hozAlign: "center",
                    width: 160,

                    formatter: function (cell) {

                        let value = cell.getValue();

                        if (value === "Available") {

                            return `
                <span class="inline-flex items-center rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">
                    
                    Available
                </span>
            `;

                        }


                        if (value === "Rented") {

                            return `
                <span class="inline-flex items-center rounded-full bg-[var(--info-soft)] px-3 py-1 text-xs font-medium text-primary">
                    
                    Rented
                </span>
            `;

                        }


                        if (value === "Under Maintenance") {

                            return `
                <span class="inline-flex items-center rounded-full bg-[var(--warning-soft)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                    
                    Maintenance
                </span>
            `;

                        }


                        if (value === "Out of Service") {

                            return `
                <span class="inline-flex items-center rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">
                    
                    Out of Service
                </span>
            `;

                        }


                        return `
            <span class="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                Unknown
            </span>
        `;

                    },
                },
                {
                    title: "Actions",
                    field: "id",
                    hozAlign: "center",
                    width: 120,
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
                title="Vehicle Registration"
                sub_text="Register, manage and maintain fleet vehicles."
                breadcrumbs={[
                    { label: "Vehicle" },
                    { label: "Vehicle Registration" }
                ]}
            />

            <div className="management-page">

                <div className="page-container">

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                        {/* CREATE FORM */}

                        {/* <Button
                            variant="default"
                            onClick={() => { resetForm(); setOpenDrawer(true); }}
                        >
                            Add Vehicle
                        </Button> */}

                        <button
                            className="btn-primary management-add"
                            onClick={() => { resetForm(); setOpenDrawer(true); }}
                        >
                            Add Vehicle
                        </button>

                        <CustomDrawer
                            open={openDrawer}
                            setOpen={setOpenDrawer}
                            title="Register Vehicle"
                            description="Add a new vehicle to your fleet"
                            submitText="Save Vehicle"
                            onSubmit={handleSubmit(save_data)}
                            size="max-w-3xl"
                        >

                            <form onSubmit={handleSubmit(save_data)} noValidate>
                                <p className="form-hint">Sample workspace. You can explore and validate this form; saving records is not connected in this module.</p>
                                {demoSubmitted && <p className="demo-submit-note" role="status">Form validated. This preview does not save a record.</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
<div className="sm:col-span-2 form-section-heading"><h2>Vehicle identity</h2><p>Registration and basic vehicle details.</p></div>
                                    {/* Vehicle Number Plate */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Vehicle Number Plate
                                        </label>

                                        <Input aria-label="Vehicle Number Plate"
                                            {...register("number_plate", { required: "This field is required." })} error={errors.number_plate?.message}
                                            type="text"
                                            placeholder="e.g. CAB-1234"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Category
                                        </label>

                                        <NativeSelect aria-label="Category"
                                            {...register("category")} error={errors.category?.message}
                                            className="custom-input-sm"
                                        >
                                            <option value="">Select Category</option>
                                            {categoryOptions.map((item, index) => (
                                                <option key={index} value={item}>{item}</option>
                                            ))}
                                        </NativeSelect>
                                    </div>

                                    {/* Brand */}

                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Brand
                                        </label>

                                        <NativeSelect aria-label="Brand"
                                            {...register("brand")} error={errors.brand?.message}
                                            className="custom-input-sm"
                                        >
                                            <option value="">Select Brand</option>
                                            {brandOptions.map((item, index) => (
                                                <option key={index} value={item}>{item}</option>
                                            ))}
                                        </NativeSelect>
                                    </div>

                                    {/* Model */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Model
                                        </label>

                                        <NativeSelect aria-label="Model"
                                            {...register("model")} error={errors.model?.message}
                                            className="custom-input-sm"
                                        >
                                            <option value="">Select Model</option>
                                            {modelOptions.map((item, index) => (
                                                <option key={index} value={item}>{item}</option>
                                            ))}
                                        </NativeSelect>
                                    </div>

                                    {/* Manufacture Year */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Manufacture Year
                                        </label>

                                        <Input aria-label="Manufacture Year"
                                            {...register("manufacture_year")} error={errors.manufacture_year?.message}
                                            type="number"
                                            placeholder="e.g. 2022"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Color */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Color
                                        </label>

                                        <Input aria-label="Color"
                                            {...register("color")} error={errors.color?.message}
                                            type="text"
                                            placeholder="e.g. White"
                                            className="custom-input-sm"
                                        />
                                    </div>

<div className="sm:col-span-2 form-section-heading"><h2>Specifications</h2><p>Technical information and capacity.</p></div>
                                    {/* Fuel Type */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Fuel Type
                                        </label>

                                        <NativeSelect aria-label="Fuel Type"
                                            {...register("fuel_type")} error={errors.fuel_type?.message}
                                            className="custom-input-sm"
                                        >
                                            <option value="">Select Fuel Type</option>
                                            {fuelTypeOptions.map((item, index) => (
                                                <option key={index} value={item}>{item}</option>
                                            ))}
                                        </NativeSelect>
                                    </div>

                                    {/* Transmission */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Transmission
                                        </label>

                                        <NativeSelect aria-label="Transmission"
                                            {...register("transmission")} error={errors.transmission?.message}
                                            className="custom-input-sm"
                                        >
                                            <option value="">Select Transmission</option>
                                            {transmissionOptions.map((item, index) => (
                                                <option key={index} value={item}>{item}</option>
                                            ))}
                                        </NativeSelect>
                                    </div>

                                    {/* Engine Number */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Engine Number
                                        </label>

                                        <Input aria-label="Engine Number"
                                            {...register("engine_number")} error={errors.engine_number?.message}
                                            type="text"
                                            placeholder="Enter engine number"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Chassis Number */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Chassis Number
                                        </label>

                                        <Input aria-label="Chassis Number"
                                            {...register("chassis_number")} error={errors.chassis_number?.message}
                                            type="text"
                                            placeholder="Enter chassis number"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Mileage */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Mileage (km)
                                        </label>

                                        <Input aria-label="Mileage (km)"
                                            {...register("mileage")} error={errors.mileage?.message}
                                            type="number"
                                            placeholder="e.g. 45000"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Seating Capacity */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Seating Capacity
                                        </label>

                                        <Input aria-label="Seating Capacity"
                                            {...register("seating_capacity")} error={errors.seating_capacity?.message}
                                            type="number"
                                            placeholder="e.g. 5"
                                            className="custom-input-sm"
                                        />
                                    </div>

<div className="sm:col-span-2 form-section-heading"><h2>Purchase & pricing</h2><p>Ownership details and existing rental rates.</p></div>
                                    {/* Purchase Date */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Purchase Date
                                        </label>

                                        <Input aria-label="Purchase Date"
                                            {...register("purchase_date")} error={errors.purchase_date?.message}
                                            type="date"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Purchase Price */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Purchase Price
                                        </label>

                                        <Input aria-label="Purchase Price"
                                            {...register("purchase_price")} error={errors.purchase_price?.message}
                                            type="number"
                                            placeholder="e.g. 5500000"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Daily Rental Rate */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Daily Rental Rate
                                        </label>

                                        <Input aria-label="Daily Rental Rate"
                                            {...register("daily_rental_rate")} error={errors.daily_rental_rate?.message}
                                            type="number"
                                            placeholder="e.g. 6000"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Weekly Rental Rate */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Weekly Rental Rate
                                        </label>

                                        <Input aria-label="Weekly Rental Rate"
                                            {...register("weekly_rental_rate")} error={errors.weekly_rental_rate?.message}
                                            type="number"
                                            placeholder="e.g. 38000"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Monthly Rental Rate */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Monthly Rental Rate
                                        </label>

                                        <Input aria-label="Monthly Rental Rate"
                                            {...register("monthly_rental_rate")} error={errors.monthly_rental_rate?.message}
                                            type="number"
                                            placeholder="e.g. 140000"
                                            className="custom-input-sm"
                                        />
                                    </div>

<div className="sm:col-span-2 form-section-heading"><h2>Compliance & availability</h2><p>Key dates and operating status.</p></div>
                                    {/* Insurance Expiry Date */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Insurance Expiry Date
                                        </label>

                                        <Input aria-label="Insurance Expiry Date"
                                            {...register("insurance_expiry_date")} error={errors.insurance_expiry_date?.message}
                                            type="date"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Registration Expiry Date */}
                                    <div>
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Registration Expiry Date
                                        </label>

                                        <Input aria-label="Registration Expiry Date"
                                            {...register("registration_expiry_date")} error={errors.registration_expiry_date?.message}
                                            type="date"
                                            className="custom-input-sm"
                                        />
                                    </div>

                                    {/* Vehicle Status */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Vehicle Status
                                        </label>

                                        <NativeSelect aria-label="Vehicle Status"
                                            {...register("vehicle_status")} error={errors.vehicle_status?.message}
                                            className="custom-input-sm"
                                        >
                                            <option value="">Select Vehicle Status</option>
                                            {vehicleStatusOptions.map((item, index) => (
                                                <option key={index} value={item}>{item}</option>
                                            ))}
                                        </NativeSelect>
                                    </div>

<div className="sm:col-span-2 form-section-heading"><h2>Vehicle images</h2><p>Upload photographs using the existing file controls.</p></div>
                                    {/* Images */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-semibold text-foreground mb-2">
                                            Vehicle Images
                                        </label>

                                        <Input aria-label="Vehicle Images"
                                            {...register("images", { onChange: handle_image_change })} error={errors.images?.message}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="custom-input-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-sm file:font-medium hover:file:bg-slate-800"
                                        />
                                        {imagePreviews.length > 0 && (
                                            <div className="flex flex-wrap gap-3 mt-3">
                                                {imagePreviews.map((src, index) => (
                                                    <img
                                                        key={index}
                                                        src={src}
                                                        alt={`preview-${index}`}
                                                        className="w-16 h-16 object-cover rounded-lg border border-border"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </form>


                        </CustomDrawer>

                        {/* TABLE */}

                        <div className="xl:col-span-12">

                            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">

                                <div className="flex items-center justify-between px-6 py-5 border-b">
                                    <div>
                                        <h2 className="text-base font-semibold text-foreground">
                                            Registered Vehicle List
                                        </h2>

                                        <p className="text-sm text-muted-foreground mt-1">
                                            Manage all fleet vehicles.
                                        </p>
                                    </div>

                                    <span className="px-3 py-1 rounded-full bg-[var(--info-soft)] text-primary text-sm font-medium">
                                        Vehicles
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