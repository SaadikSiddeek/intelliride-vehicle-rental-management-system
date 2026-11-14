/* eslint-disable react-refresh/only-export-components -- This registry exports a router with lazy screen components. */
import { lazy } from "react";
import Landing from "./views/Landing";
const AIAgent = lazy(() => import("./views/ai/AIAgent"));
const AIChatbot = lazy(() => import("./views/ai/AIChatbot"));
const Settings = lazy(() => import("./views/Settings"));
import { createBrowserRouter } from "react-router-dom";
const Login = lazy(() => import("./views/Login"));
const Signup = lazy(() => import("./views/Signup"));
const Permissions = lazy(() => import("./views/permissions/Permissions"));
const Users = lazy(() => import("./views/users/Users"));
const NotFound = lazy(() => import("./views/NotFound"));
import DefaultLayout from "./components/DefaultLayout";
import GuestLayout from "./components/GuestLayout";
const CompanySettings = lazy(() => import("./views/CompanySettings"));
const MyProfile = lazy(() => import("./views/MyProfile"));
const Dashboard = lazy(() => import("./views/Dashboard"));
const Role = lazy(() => import("./views/role/Role"));
const Branch = lazy(() => import("./views/branch/Branch"));
const VehicleCategory = lazy(
  () => import("./views/vehicleCategory/VehicleCategory"),
);
const VehicleBrand = lazy(() => import("./views/vehicleBrand/VehicleBrand"));
const VehicleModel = lazy(() => import("./views/vehicleModel/VehicleModel"));
const FuelType = lazy(() => import("./views/fuelType/FuelType"));
const TransmissionType = lazy(
  () => import("./views/transmission/TransmissionType"),
);
const VehicleFeature = lazy(() => import("./views/features/Features"));
const VehicleRegistration = lazy(
  () => import("./views/registerVehicle/RegisterVehicle"),
);
const Staff = lazy(() => import("./views/staff/Staff"));
const Department = lazy(() => import("./views/department/Department"));
const Designation = lazy(() => import("./views/designation/Designation"));
const Reports = lazy(() => import("./views/reports/Reports"));
const VehicleDocuments = lazy(() => import("./views/fleetOperations/VehicleDocuments"));
const Maintenance = lazy(() => import("./views/fleetOperations/Maintenance"));
const Invoices = lazy(() => import("./views/finance/Invoices"));
const Payments = lazy(() => import("./views/finance/Payments"));
const DepositRefunds = lazy(() => import("./views/finance/DepositRefunds"));
const Return = lazy(() => import("./views/returns/Return"));
const ActiveRental = lazy(() => import("./views/activeRentals/ActiveRental"));
const Booking = lazy(() => import("./views/bookings/Booking"));
const Customer = lazy(() => import("./views/customers/Customer"));
const RentalPackage = lazy(() => import("./views/rentalPackage/RentalPackage"));

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },

  // DEFAULT LAYOUT ROUTES
  {
    path: "/",
    element: <DefaultLayout />,
    children: [
      { path: "/permission-management/manage", element: <Permissions /> },
      { path: "/ai/agent", element: <AIAgent /> },
      { path: "/ai/chatbot", element: <AIChatbot /> },
      { path: "/settings", element: <Settings /> },
      { path: "/company-settings", element: <CompanySettings /> },
      { path: "/my-profile", element: <MyProfile /> },
      {
        path: "/dashboard",
        element: <Dashboard />,
      },
      {
        path: "/user-management/manage",
        element: <Users />,
        name: "user",
      },
      {
        path: "/role-management/manage",
        element: <Role />,
        name: "role",
      },
      {
        path: "/branch-management/manage",
        element: <Branch />,
        name: "branch",
      },
      {
        path: "/vehicle-category-management/manage",
        element: <VehicleCategory />,
        name: "vehicleCategory",
      },
      {
        path: "/vehicle-brand-management/manage",
        element: <VehicleBrand />,
        name: "vehicleBrand",
      },
      {
        path: "/vehicle-model-management/manage",
        element: <VehicleModel />,
        name: "vehicleModel",
      },
      {
        path: "/fuel-type-management/manage",
        element: <FuelType />,
        name: "fuelType",
      },
      {
        path: "/transmission-type-management/manage",
        element: <TransmissionType />,
        name: "transmissionType",
      },
      {
        path: "/vehicle-feature-management/manage",
        element: <VehicleFeature />,
        name: "vehicleFeature",
      },
      {
        path: "/register-vehicle-management/manage",
        element: <VehicleRegistration />,
        name: "registerVehicle",
      },
      {
        path: "/staff-management/manage",
        element: <Staff />,
        name: "staff",
      },
      {
        path: "/department-management/manage",
        element: <Department />,
        name: "department",
      },
      {
        path: "/designation-management/manage",
        element: <Designation />,
        name: "designation",
      },
      {
        path: "/reports/:type",
        element: <Reports />,
      },
      {
        path: "/vehicle-document-management/manage",
        element: <VehicleDocuments />,
      },
      {
        path: "/maintenance-management/manage",
        element: <Maintenance />,
      },
      {
        path: "/invoice-management/manage",
        element: <Invoices />,
      },
      {
        path: "/payment-management/manage",
        element: <Payments />,
      },
      {
        path: "/deposit-refund-management/manage",
        element: <DepositRefunds />,
      },
      {
        path: "/return-management/manage",
        element: <Return />,
        name: "return",
      },
      {
        path: "/active-rental-management/manage",
        element: <ActiveRental />,
        name: "activeRental",
      },
      {
        path: "/booking-management/manage",
        element: <Booking />,
        name: "booking",
      },
      {
        path: "/customer-management/manage",
        element: <Customer />,
        name: "customer",
      },
      {
        path: "/rental-package-management/manage",
        element: <RentalPackage />,
        name: "rentalPackage",
      },
    ],
  },

  // GUEST LAYOUT ROUTES
  {
    path: "/",
    element: <GuestLayout />,
    children: [
      {
        path: "/login",
        element: <Login />,
      },

      {
        path: "/signup",
        element: <Signup />,
      },
    ],
  },

  // PAGE NOT FOUND ROUTE
  {
    path: "*",
    element: <NotFound />,
  },
]);

export default router;
