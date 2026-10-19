import { Bot, Send, MessageSquare, LockKeyhole } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
export default function AIChatbot() {
  return (
    <>
      <PageHeader
        title="AI Chatbot"
        sub_text="A dedicated space for conversations about your operations."
        breadcrumbs={[{ label: "AI" }, { label: "Chatbot" }]}
      />
      <div className="chat-workspace">
        <header>
          <span className="ai-mark">
            <Bot size={23} />
          </span>
          <div>
            <h2>IntelliRide Assistant</h2>
            <p>Workspace assistant</p>
          </div>
          <Badge tone="warning">Not connected</Badge>
        </header>
        <div className="chat-empty">
          <span className="ai-empty-icon">
            <MessageSquare size={32} />
          </span>
          <h2>Start with a conversation.</h2>
          <p>
            Your AI assistant will be available here when your organization
            connects its AI service.
          </p>
          <div className="ai-unavailable">
            <LockKeyhole size={17} />
            <span>
              Chat is not available in this version. No messages are sent.
            </span>
          </div>
        </div>
        <div className="chat-composer">
          <label htmlFor="ai-message" className="sr-only">
            Message
          </label>
          <textarea
            id="ai-message"
            disabled
            placeholder="AI service is not connected"
            rows={2}
          />
          <Button disabled size="icon" aria-label="Send message unavailable">
            <Send />
          </Button>
        </div>
        <p className="chat-footnote">
          AI responses will appear here once the service is connected.
        </p>
      </div>
    </>
  );
}
