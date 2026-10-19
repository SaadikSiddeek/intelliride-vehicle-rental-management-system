import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Bot, X, Send, PlugZap, LoaderCircle, ArrowUpRight } from "lucide-react";

/** Optional adapter: { sendMessage(text, { signal }): Promise<{ content: string }> }.
 * No adapter means no network activity, no simulated replies, and a disabled composer.
 */
export default function FloatingAssistant({ adapter = null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(null);
  const connected = typeof adapter?.sendMessage === "function";
  useEffect(() => () => pending.current?.abort(), []);
  const submit = async event => {
    event.preventDefault();
    const text = draft.trim();
    if (!connected || !text || sending) return;
    const controller = new AbortController();
    pending.current = controller;
    setSending(true); setError(""); setDraft("");
    setMessages(previous => [...previous, { role: "user", content: text }]);
    try {
      const result = await adapter.sendMessage(text, { signal: controller.signal });
      if (!controller.signal.aborted && typeof result?.content === "string") setMessages(previous => [...previous, { role: "assistant", content: result.content }]);
    } catch (failure) {
      if (failure.name !== "AbortError") setError("Your message could not be sent. Please try again.");
    } finally { if (!controller.signal.aborted) setSending(false); }
  };
  return <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
    <Dialog.Trigger render={<button className="assistant-launcher" aria-label="Open IntelliRide Assistant" aria-controls="intelliride-assistant"/>}>{open ? <X size={22}/> : <Bot size={23}/>}</Dialog.Trigger>
    <Dialog.Portal><Dialog.Popup id="intelliride-assistant" className="assistant-panel">
      <header className="assistant-header"><span className="assistant-mark"><Bot size={21}/></span><div><Dialog.Title>IntelliRide Assistant</Dialog.Title><Dialog.Description>{connected ? "Connected assistant" : "Integration coming soon"}</Dialog.Description></div><Dialog.Close aria-label="Close assistant" className="assistant-close"><X size={18}/></Dialog.Close></header>
      <div className="assistant-messages" aria-live="polite" role="log" aria-label="Conversation">
        {messages.length === 0 ? <div className="assistant-empty"><span><PlugZap size={25}/></span><h3>{connected ? "How can we help?" : "A little help, on the horizon."}</h3><p>{connected ? "Send a message to your connected assistant." : "Your IntelliRide assistant integration will be available here."}</p>{!connected && <><span className="connection-label">Not connected</span><a href="#features" onClick={() => setOpen(false)}>Explore the platform <ArrowUpRight size={14}/></a></>}</div> : messages.map((message, index) => <p key={index} className={`assistant-message message-${message.role}`}>{message.content}</p>)}
        {sending && <p className="assistant-progress"><LoaderCircle className="animate-spin" size={14}/> Sending your message…</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <form className="assistant-composer" onSubmit={submit}><label className="sr-only" htmlFor="assistant-message">Message IntelliRide Assistant</label><input id="assistant-message" value={draft} onChange={event => setDraft(event.target.value)} disabled={!connected || sending} maxLength={2000} placeholder={connected ? "Ask your assistant…" : "Assistant is not connected"}/><button type="submit" disabled={!connected || sending || !draft.trim()} aria-label="Send message"><Send size={17}/></button></form>
      <p className="assistant-footnote">{connected ? "Review answers before taking action." : "No messages are sent until a service is connected."}</p>
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>;
}
