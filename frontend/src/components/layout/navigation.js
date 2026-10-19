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
} from "lucide-react";
export const navigation = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
      {
        label: "Vehicles",
        to: "/register-vehicle-management/manage",
        icon: CarFront,
      },
      { label: "Users", to: "/user-management/manage", icon: Users },
      { label: "Staff", to: "/staff-management/manage", icon: UserRoundCog },
      { label: "Branches", to: "/branch-management/manage", icon: Building2 },
    ],
  },
  {
    label: "CONFIGURATION",
    items: [
      {
        label: "Roles & access",
        to: "/role-management/manage",
        icon: ShieldCheck,
      },
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
