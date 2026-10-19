// Original supplied dashboard fixtures. These are NOT API data.
export const KPIS = [
  {
    label: "Total Fleet Size",
    value: "248",
    unit: "vehicles",
    icon: "fa-car-side",
    accent: "slate",
    trend: 7.8,
    trendLabel: "18 added this month",
    spark: [40, 44, 42, 48, 46, 52, 55, 53, 58, 60, 59, 63],
  },
  {
    label: "Active Rentals",
    value: "132",
    unit: "on the road",
    icon: "fa-key",
    accent: "amber",
    trend: 12.4,
    trendLabel: "vs last week",
    spark: [28, 30, 33, 31, 36, 38, 35, 40, 42, 41, 45, 47],
  },
  {
    label: "Monthly Revenue",
    value: "Rs. 4,286,500",
    unit: "this month",
    icon: "fa-sack-dollar",
    accent: "emerald",
    trend: 9.2,
    trendLabel: "vs last month",
    spark: [30, 32, 35, 34, 38, 40, 39, 43, 46, 48, 47, 52],
  },
  {
    label: "Overdue Returns",
    value: "7",
    unit: "need follow-up",
    icon: "fa-triangle-exclamation",
    accent: "rose",
    trend: -3,
    trendLabel: "fewer than last week",
    spark: [12, 11, 13, 10, 9, 11, 8, 9, 7, 8, 6, 7],
  },
];

export const REVENUE_TREND = [
  { month: "Jan", value: 2650 },
  { month: "Feb", value: 2890 },
  { month: "Mar", value: 3120 },
  { month: "Apr", value: 2980 },
  { month: "May", value: 3340 },
  { month: "Jun", value: 3510 },
  { month: "Jul", value: 3280 },
  { month: "Aug", value: 3690 },
  { month: "Sep", value: 3950 },
  { month: "Oct", value: 4110 },
  { month: "Nov", value: 3980 },
  { month: "Dec", value: 4286 },
];

export const FLEET_STATUS = [
  { label: "Rented", value: 132, color: "var(--chart-1)" },
  { label: "Available", value: 96, color: "var(--chart-2)" },
  { label: "Maintenance", value: 14, color: "var(--chart-3)" },
  { label: "Out of Service", value: 6, color: "var(--chart-5)" },
];

export const CATEGORY_PERFORMANCE = [
  { label: "Sedan", value: 420 },
  { label: "SUV", value: 310 },
  { label: "Hatchback", value: 260 },
  { label: "Van / KDH", value: 190 },
  { label: "Electric", value: 95 },
  { label: "Luxury", value: 60 },
];

export const RECENT_RENTALS = [
  {
    vehicle: "Toyota Prius",
    plate: "CAB-4471",
    customer: "Nimal Perera",
    status: "Active",
    due: "Aug 09, 2026",
    amount: "Rs. 12,500",
  },
  {
    vehicle: "Honda Vezel",
    plate: "KV-2298",
    customer: "Dilani Fernando",
    status: "Reserved",
    due: "Aug 11, 2026",
    amount: "Rs. 15,800",
  },
  {
    vehicle: "Suzuki Wagon R",
    plate: "CBA-1187",
    customer: "Kasun Silva",
    status: "Overdue",
    due: "Aug 04, 2026",
    amount: "Rs. 8,200",
  },
  {
    vehicle: "Toyota Axio",
    plate: "KX-9903",
    customer: "Anjali Jayasuriya",
    status: "Active",
    due: "Aug 08, 2026",
    amount: "Rs. 11,000",
  },
  {
    vehicle: "Nissan Leaf",
    plate: "EV-0231",
    customer: "Ruwan Bandara",
    status: "Completed",
    due: "Aug 02, 2026",
    amount: "Rs. 9,600",
  },
  {
    vehicle: "Toyota Hiace",
    plate: "KDH-7742",
    customer: "Sanduni Wickrama",
    status: "Active",
    due: "Aug 12, 2026",
    amount: "Rs. 24,000",
  },
];

export const TOP_VEHICLES = [
  { name: "Toyota Prius", bookings: 46, revenue: "Rs. 342,000", share: 92 },
  { name: "Honda Vezel", bookings: 39, revenue: "Rs. 298,500", share: 80 },
  {
    name: "Toyota Hiace (KDH)",
    bookings: 27,
    revenue: "Rs. 264,000",
    share: 71,
  },
  { name: "Suzuki Wagon R", bookings: 33, revenue: "Rs. 187,400", share: 50 },
  { name: "Nissan Leaf", bookings: 21, revenue: "Rs. 151,900", share: 41 },
];

export const UPCOMING_RETURNS = [
  {
    vehicle: "Suzuki Wagon R · CBA-1187",
    customer: "Kasun Silva",
    due: "Overdue by 2 days",
    urgency: "high",
  },
  {
    vehicle: "Toyota Prius · CAB-4471",
    customer: "Nimal Perera",
    due: "Due today, 4:00 PM",
    urgency: "high",
  },
  {
    vehicle: "Honda Vezel · KV-2298",
    customer: "Dilani Fernando",
    due: "Due tomorrow, 10:00 AM",
    urgency: "medium",
  },
  {
    vehicle: "Toyota Axio · KX-9903",
    customer: "Anjali Jayasuriya",
    due: "Due in 3 days",
    urgency: "low",
  },
  {
    vehicle: "Toyota Hiace · KDH-7742",
    customer: "Sanduni Wickrama",
    due: "Due in 4 days",
    urgency: "low",
  },
];
