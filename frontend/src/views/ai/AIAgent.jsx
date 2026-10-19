import { Bot, PlugZap, Activity, ListChecks } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
export default function AIAgent() {
  return (
    <>
      <PageHeader
        title="AI Agent"
        sub_text="A central workspace for connected AI assistance."
        breadcrumbs={[{ label: "AI" }, { label: "Agent" }]}
      />
      <Card className="agent-overview">
        <CardContent>
          <span className="ai-empty-icon">
            <Bot size={32} />
          </span>
          <div>
            <span className="eyebrow">AGENT OVERVIEW</span>
            <h2>Your agent workspace is ready.</h2>
            <p>
              There is no AI agent connected to this version. Agent actions and
              insights will appear here when the service is available.
            </p>
          </div>
          <Badge tone="warning">Not connected</Badge>
        </CardContent>
      </Card>
      <div className="agent-grid">
        {[
          [
            PlugZap,
            "Connection",
            "No AI service connected",
            "Contact your system administrator to enable an AI integration.",
          ],
          [
            ListChecks,
            "Available actions",
            "No actions available",
            "Actions are shown only when a connected agent supports them.",
          ],
          [
            Activity,
            "Recent activity",
            "No agent activity yet",
            "Completed tasks and real agent events will appear here.",
          ],
        ].map(([Icon, title, empty, description]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon size={18} />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="agent-empty">
                <Icon size={26} />
                <h3>{empty}</h3>
                <CardDescription>{description}</CardDescription>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
