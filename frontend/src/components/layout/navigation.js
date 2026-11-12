import {
  LayoutDashboard,
  CarFront,
  Users,
  UserRoundCog,
  Building2,
  ShieldCheck,
  Layers3,
  Tags,
  Shapes,
  Fuel,
  Cog,
  ListChecks,
  Network,
  BriefcaseBusiness,
  Bot,
  MessageSquare,
  Settings2,
  ContactRound,
  Package,
  CalendarDays,
} from "lucide-react";
export const navigation = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "RENTAL OPERATIONS",
    items: [
      { label: "Customers", to: "/customer-management/manage", icon: ContactRound },
      { label: "Bookings", to: "/booking-management/manage", icon: CalendarDays },
      { label: "Active Rentals", to: "/active-rental-management/manage", icon: CarFront },
      { label: "Returns", to: "/return-management/manage", icon: CalendarDays },
    ],
  },
  {
    label: "FLEET",
    items: [
      { label: "Vehicle Documents", to: "/vehicle-document-management/manage", icon: ListChecks },
      { label: "Maintenance", to: "/maintenance-management/manage", icon: Cog },
      {
        label: "Vehicles",
        to: "/register-vehicle-management/manage",
        icon: CarFront,
      },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { label: "Invoices", to: "/invoice-management/manage", icon: ListChecks },
      { label: "Payments", to: "/payment-management/manage", icon: Tags },
      { label: "Deposit Refunds", to: "/deposit-refund-management/manage", icon: ShieldCheck },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { label: "Rental History", to: "/reports/rental_history", icon: ListChecks },
      { label: "Staff Handovers", to: "/reports/staff_handover", icon: UserRoundCog },
      { label: "Customer History", to: "/reports/customer_history", icon: ContactRound },
      { label: "Vehicle Utilization", to: "/reports/vehicle_utilization", icon: CarFront },
      { label: "Financial Reports", to: "/reports/financial", icon: Tags },
      { label: "Other Reports", to: "/reports/booking_history", icon: CalendarDays },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { label: "Company Settings", to: "/company-settings", icon: Building2, adminOnly: true },
      { label: "Users", to: "/user-management/manage", icon: Users },
      { label: "Staff", to: "/staff-management/manage", icon: UserRoundCog },
      { label: "Branches", to: "/branch-management/manage", icon: Building2 },
      { label: "Roles & access", to: "/role-management/manage", icon: ShieldCheck },
    ],
  },
  {
    label: "CONFIGURATION",
    items: [
      { label: "Rental Packages", to: "/rental-package-management/manage", icon: Package },
      {
        label: "Departments",
        to: "/department-management/manage",
        icon: Network,
      },
      {
        label: "Designations",
        to: "/designation-management/manage",
        icon: BriefcaseBusiness,
      },
      {
        label: "Categories",
        to: "/vehicle-category-management/manage",
        icon: Layers3,
      },
      { label: "Brands", to: "/vehicle-brand-management/manage", icon: Tags },
      { label: "Models", to: "/vehicle-model-management/manage", icon: Shapes },
      { label: "Fuel types", to: "/fuel-type-management/manage", icon: Fuel },
      {
        label: "Transmissions",
        to: "/transmission-type-management/manage",
        icon: Cog,
      },
      {
        label: "Vehicle features",
        to: "/vehicle-feature-management/manage",
        icon: ListChecks,
      },
    ],
  },
  {
    label: "AI WORKSPACE",
    items: [
      { label: "AI Agent", to: "/ai/agent", icon: Bot },
      { label: "AI Chatbot", to: "/ai/chatbot", icon: MessageSquare },
    ],
  },
  {
    label: "PREFERENCES",
    items: [{ label: "Appearance", to: "/settings", icon: Settings2 }],
  },
];
export const navigationItems = navigation.flatMap((group) => group.items);
