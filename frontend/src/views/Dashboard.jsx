import { Link } from "react-router-dom";
import {
  CarFront,
  KeyRound,
  Wallet,
  Clock3,
  ArrowUpRight,
  Plus,
  Users,
  Building2,
  Info,
  Sparkles,
  MoveUpRight,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  KPIS,
  REVENUE_TREND,
  FLEET_STATUS,
  RECENT_RENTALS,
  CATEGORY_PERFORMANCE,
  TOP_VEHICLES,
  UPCOMING_RETURNS,
} from "../components/dashboard/sample-data";
import { RevenueChart, FleetDonut } from "../components/dashboard/Charts";
const icons = [CarFront, KeyRound, Wallet, Clock3];
const tones = {
  Active: "success",
  Reserved: "info",
  Overdue: "danger",
  Completed: "neutral",
};
export default function Dashboard() {
  return (
    <>
      <PageHeader
        title="Operations overview"
        sub_text="A clear view of your fleet, people, and daily operations."
        breadcrumbs={[{ label: "Overview" }]}
      >
        <Link to="/register-vehicle-management/manage" className="btn-primary">
          <Plus size={16} />
          Manage vehicles
        </Link>
      </PageHeader>
      <div className="ir-dashboard-welcome">
        <div><span><Sparkles size={14}/> YOUR INTELLIRIDE WORKSPACE</span><h2>A better view of the road ahead.</h2><p>Your fleet, people and operations—organized for your next move. Metrics below are illustrative demo records.</p></div>
        <Link to="/settings" className="ir-welcome-action">Personalize workspace <MoveUpRight size={16}/></Link>
        <span className="ir-welcome-decoration" aria-hidden="true"><CarFront size={130} strokeWidth={1}/></span>
      </div>
      <div className="sample-notice">
        <Info size={16} />
        <span>
          <strong>Sample dashboard.</strong> These are the original
          demonstration records, not live business data.
        </span>
        <Badge tone="info">Preview</Badge>
      </div>
      <div className="kpi-grid">
        {KPIS.map((k, i) => {
          const Icon = icons[i];
          return (
            <Card key={k.label} className="kpi-card">
              <CardContent>
                <div className="kpi-top">
                  <span>{k.label}</span>
                  <span className={`kpi-icon kpi-icon-${i}`}>
                    <Icon size={19} />
                  </span>
                </div>
                <div className="kpi-value">{k.value}</div>
                <div className="kpi-foot">
                  <span className="kpi-trend">
                    <ArrowUpRight size={13} />
                    {Math.abs(k.trend)}
                    {i === 3 ? "" : "%"}
                  </span>
                  <span>{k.trendLabel}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="dashboard-charts">
        <Card>
          <CardHeader>
            <div className="section-title-row">
              <CardTitle>Revenue overview</CardTitle>
              <Badge>2026 · Sample</Badge>
            </div>
            <CardDescription>Monthly rental income · LKR</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={REVENUE_TREND} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fleet availability</CardTitle>
            <CardDescription>
              Distribution across your sample fleet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FleetDonut data={FLEET_STATUS} />
          </CardContent>
        </Card>
      </div>
      <div className="quick-actions">
        <span>QUICK ACCESS</span>
        <Link to="/register-vehicle-management/manage">
          <CarFront />
          Vehicle register
          <ArrowUpRight />
        </Link>
        <Link to="/user-management/manage">
          <Users />
          Manage users
          <ArrowUpRight />
        </Link>
        <Link to="/branch-management/manage">
          <Building2 />
          Branch directory
          <ArrowUpRight />
        </Link>
      </div>
      <Card className="recent-rentals">
        <CardHeader>
          <div className="section-title-row">
            <div>
              <CardTitle>Recent rentals</CardTitle>
              <CardDescription>
                Original sample bookings across the fleet
              </CardDescription>
            </div>
            <Badge>{RECENT_RENTALS.length} sample records</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Return date</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_RENTALS.map((r) => (
                  <tr key={r.plate}>
                    <td>
                      <div className="vehicle-cell">
                        <span className="vehicle-thumb">
                          <CarFront size={20} />
                        </span>
                        <span>
                          <strong>{r.vehicle}</strong>
                          <small>{r.plate}</small>
                        </span>
                      </div>
                    </td>
                    <td>{r.customer}</td>
                    <td>
                      <Badge tone={tones[r.status]}>{r.status}</Badge>
                    </td>
                    <td className="muted">{r.due}</td>
                    <td className="text-right font-medium">{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="dashboard-bottom">
        <Card>
          <CardHeader>
            <CardTitle>Rentals by category</CardTitle>
            <CardDescription>Sample bookings by vehicle type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bar-list">
              {CATEGORY_PERFORMANCE.map((c) => (
                <div key={c.label}>
                  <div>
                    <span>{c.label}</span>
                    <strong>{c.value}</strong>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${(c.value / 420) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top performing vehicles</CardTitle>
            <CardDescription>Sample revenue ranking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="ranking-list">
              {TOP_VEHICLES.map((v, i) => (
                <div key={v.name}>
                  <span className="rank-number">{i + 1}</span>
                  <span>
                    <strong>{v.name}</strong>
                    <small>{v.bookings} bookings</small>
                  </span>
                  <b>{v.revenue}</b>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming returns</CardTitle>
            <CardDescription>From the original sample schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="return-list">
              {UPCOMING_RETURNS.map((u) => (
                <div key={u.vehicle}>
                  <span className={`return-dot ${u.urgency}`} />
                  <div>
                    <strong>{u.vehicle}</strong>
                    <small>{u.customer}</small>
                    <span
                      className={
                        u.urgency === "high" ? "text-destructive" : "muted"
                      }
                    >
                      {u.due}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
