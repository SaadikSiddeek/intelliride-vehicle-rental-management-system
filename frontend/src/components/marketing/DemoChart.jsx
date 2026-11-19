import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { demoMoney } from "./demo-state.mjs";
export default function DemoChart({ invoices }) {
 const rows=['06-12','06-14','06-16','06-18','06-20'].map(day=>({day,revenue:invoices.filter(item=>item.issued_on.endsWith(day)).reduce((sum,item)=>sum+item.total,0),collections:day==='06-16'?invoices.reduce((sum,item)=>sum+item.paid,0):0}));
 return <div role="img" aria-label="Sample invoice revenue and rental collections" style={{height:160,minWidth:0}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={rows}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="day" tick={{fontSize:10}}/><YAxis width={42} tick={{fontSize:10}} tickFormatter={value=>value?`${value/1000}k`:'0'}/><Tooltip formatter={value=>demoMoney(value)}/><Area type="monotone" dataKey="revenue" name="Invoice revenue" stroke="var(--primary)" fill="var(--primary)" fillOpacity={.13}/><Area type="monotone" dataKey="collections" name="Rental collections" stroke="var(--success)" fill="var(--success)" fillOpacity={.1}/></AreaChart></ResponsiveContainer></div>;
}
