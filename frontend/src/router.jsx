/* eslint-disable react-refresh/only-export-components -- This registry exports a router with lazy screen components. */
import { lazy } from "react";
import Landing from "./views/Landing";
const AIAgent = lazy(() => import("./views/ai/AIAgent"));
const AIChatbot = lazy(() => import("./views/ai/AIChatbot"));
const Settings = lazy(() => import("./views/Settings"));
import { createBrowserRouter } from "react-router-dom";
const Login = lazy(() => import("./views/Login"));
const Signup = lazy(() => import("./views/Signup"));
const Users = lazy(() => import("./views/users/Users"));
const NotFound = lazy(() => import("./views/NotFound"));
import DefaultLayout from "./components/DefaultLayout";
import GuestLayout from "./components/GuestLayout";
const Dashboard = lazy(() => import("./views/Dashboard"));
const Role = lazy(() => import("./views/role/Role"));
const Branch = lazy(() => import("./views/branch/Branch"));
const VehicleCategory = lazy(() => import("./views/vehicleCategory/VehicleCategory"));
const VehicleBrand = lazy(() => import("./views/vehicleBrand/VehicleBrand"));
const VehicleModel = lazy(() => import("./views/vehicleModel/VehicleModel"));
const FuelType = lazy(() => import("./views/fuelType/FuelType"));
const TransmissionType = lazy(() => import("./views/transmission/TransmissionType"));
const VehicleFeature = lazy(() => import("./views/features/Features"));
const VehicleRegistration = lazy(() => import("./views/registerVehicle/RegisterVehicle"));
const Staff = lazy(() => import("./views/staff/Staff"));
const Department = lazy(() => import("./views/department/Department"));
const Designation = lazy(() => import("./views/designation/Designation"));

const router = createBrowserRouter([
    { path: "/", element: <Landing /> },

    // DEFAULT LAYOUT ROUTES
    {
        path: '/',
        element: <DefaultLayout />,
        children: [

            { path: '/ai/agent', element: <AIAgent /> },
            { path: '/ai/chatbot', element: <AIChatbot /> },
            { path: '/settings', element: <Settings /> },
            {
                path: '/dashboard',
                element: <Dashboard />
            },
            {
                path: '/user-management/manage',
                element: <Users />,
                name: "user"
            },
            {
                path: '/role-management/manage',
                element: <Role />,
                name: "role"
            },
            {
                path: '/branch-management/manage',
                element: <Branch />,
                name: "branch"
            },
            {
                path: '/vehicle-category-management/manage',
                element: <VehicleCategory />,
                name: "vehicleCategory"
            },
            {
                path: '/vehicle-brand-management/manage',
                element: <VehicleBrand />,
                name: "vehicleBrand"
            },
            {
                path: '/vehicle-model-management/manage',
                element: <VehicleModel />,
                name: "vehicleModel"
            },
            {
                path: '/fuel-type-management/manage',
                element: <FuelType />,
                name: "fuelType"
            },
            {
                path: '/transmission-type-management/manage',
                element: <TransmissionType />,
                name: "transmissionType"
            },
            {
                path: '/vehicle-feature-management/manage',
                element: <VehicleFeature />,
                name: "vehicleFeature"
            },
            {
                path: '/register-vehicle-management/manage',
                element: <VehicleRegistration />,
                name: "registerVehicle"
            },
            {
                path: '/staff-management/manage',
                element: <Staff />,
                name: "staff"
            },
            {
                path: '/department-management/manage',
                element: <Department />,
                name: "department"
            },
            {
                path: '/designation-management/manage',
                element: <Designation />,
                name: "designation"
            },

        ]
    },

    // GUEST LAYOUT ROUTES
    {
        path: '/',
        element: <GuestLayout />,
        children: [

            {
                path: '/login',
                element: <Login />
            },

            {
                path: '/signup',
                element: <Signup />
            },

        ]
    },

    // PAGE NOT FOUND ROUTE
    {
        path: '*',
        element: <NotFound />
    },

]);

export default router;