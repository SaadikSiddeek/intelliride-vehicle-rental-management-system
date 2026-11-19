import TypingIndicator from "@/components/TypingIndicator";
import { readableChatText } from "../../lib/chat-text.mjs";
import { useState } from "react";
import { Bot, Check, Copy, Plus, RefreshCw, Send, Square } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import useConversation from "@/hooks/useConversation";
import "./chatbot.css";

const starters = [
  "How do I create a new booking?",
  "How do I check vehicle availability?",
  "How do I activate a rental?",
  "How do I correct a confirmed booking date?",
  "How do I complete a vehicle return?",
  "How do I record a customer payment?",
  "When is an invoice generated?",
  "How do I check outstanding balances?",
  "How do I generate a rental report?"
];
const time = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AIChatbot() {
  const {messages,draft,setDraft,status,busy,notice,setNotice,scroll,input,trackScroll,send,stop,newChat,refresh,failed} = useConversation();
  const [copied,setCopied] = useState(null);
  async function copy(message) {
    try {
      await navigator.clipboard.writeText(readableChatText(message.content));
      setCopied(message.id);
    } catch {
      setNotice("Copy was unavailable. Select the response text to copy it.");
    }
  }
  return (
    <>
      <PageHeader
        title="AI Chatbot"
        sub_text="Guidance for your rental workspace."
        breadcrumbs={[{ label: "AI" }, { label: "Chatbot" }]}
      />
      <section
        className="chat-workspace ir-chat"
        aria-label="IntelliRide Assistant"
      >
        <header>
          <span className="ai-mark">
            <Bot size={23} />
          </span>
          <div className="ir-chat-identity">
            <h2>IntelliRide Assistant</h2>
            <p role="status">{status}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Check AI connection"
            onClick={() => void refresh()}
          >
            <RefreshCw size={17} />
          </Button>
          <Button variant="outline" onClick={newChat}>
            <Plus size={16} />
            New chat
          </Button>
        </header>
        <div
          ref={scroll}
          className="ir-chat-thread"
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          aria-relevant="additions text"
          onScroll={trackScroll}
        >
          {!messages.length && (
            <div className="ir-chat-welcome">
              <span className="ai-empty-icon">
                <Bot size={30} />
              </span>
              <h2>How can I help you today?</h2>
              <p>
                Ask for rental workflow guidance. Verify advice against your
                saved records and company policy.
              </p>
              <div className="ir-chat-starters">
                {starters.map((question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => {
                      void send(question);
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`ir-chat-message ir-chat-${message.role}`}
              aria-label={
                message.role === "user" ? "Your message" : "Assistant response"
              }
            >
              {message.role === "assistant" && (
                <Bot size={20} aria-hidden="true" />
              )}
              <div className="ir-chat-body">
                <div className="ir-chat-content">
                  {message.role === "assistant"
                    ? readableChatText(message.content)
                    : message.content}
                </div>
                <div className="ir-chat-meta">
                  <time dateTime={new Date(message.at).toISOString()}>
                    {time(message.at)}
                  </time>
                  {message.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => void copy(message)}
                      aria-label="Copy response"
                    >
                      {copied === message.id ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copied === message.id ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
                {message.state === "error" && (
                  <div className="ir-chat-error" role="alert">
                    <p>{message.error}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void send(message.content, message.id)}
                    >
                      Retry message
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {busy && <TypingIndicator/>}
        </div>
        {notice && (
          <p className="ir-chat-notice" role="status">
            {notice}
          </p>
        )}
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor="ai-message" className="sr-only">
            Message IntelliRide Assistant
          </label>
          <textarea
            ref={input}
            id="ai-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={6000}
            disabled={failed}
            placeholder={
              failed
                ? "Retry the failed message or start a new chat"
                : "Ask IntelliRide Assistant…"
            }
            rows={1}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
          {busy ? (
            <Button
              type="button"
              size="icon"
              onClick={stop}
              aria-label="Stop response"
            >
              <Square size={16} />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || failed}
              aria-label="Send message"
            >
              <Send size={18} />
            </Button>
          )}
        </form>
        <p className="chat-footnote">
          AI can make mistakes. Chat text is sent to the configured AI provider.
          Keep passwords and private customer details out of chat.
        </p>
      </section>
    </>
  );
}
