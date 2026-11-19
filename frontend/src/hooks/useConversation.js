import { useEffect, useRef, useState } from "react";
import {checkAssistant,sendAssistantMessage,chatError} from "@/lib/ai-chat";
export default function useConversation({scope="internal",enabled=true}={}) {
  const [messages, setMessages] = useState([]),
    [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Checking service"),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef(null),
    healthRequest = useRef(null),
    scroll = useRef(null),
    input = useRef(null),
    follow = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    checkAssistant(controller.signal, scope)
      .then((data) =>
        setStatus(data.available ? "Service ready" : "Provider not configured"),
      )
      .catch(() => {
        if (!controller.signal.aborted) setStatus("Service unavailable");
      });
    return () => {
      controller.abort();
      healthRequest.current?.abort();
    };
  }, [enabled, scope]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, busy, enabled]);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 160)}px`;
    }
  }, [draft]);

  async function refresh() {
    healthRequest.current?.abort();
    const controller = new AbortController();
    healthRequest.current = controller;
    setStatus("Checking service");
    try {
      const data = await checkAssistant(controller.signal, scope);
      if (!controller.signal.aborted)
        setStatus(data.available ? "Service ready" : "Provider not configured");
    } catch {
      if (!controller.signal.aborted) setStatus("Service unavailable");
    }
  }

  async function send(value = draft, retryId = null) {
    const content = value.trim();
    if (!content || request.current || content.length > (scope === "public" ? 2000 : 6000)) return;
    const prior = retryId
      ? messages.slice(
          0,
          messages.findIndex((item) => item.id === retryId),
        )
      : messages;
    const completed = prior.filter((item) => item.state === "sent");
    const history = completed.map(({ role, content }) => ({ role, content: scope === "public" ? content.slice(0,2000) : content }));
    if (
      history.length > (scope === "public" ? 10 : 20) ||
      history.reduce((sum, item) => sum + item.content.length, content.length) >
        (scope === "public" ? 12000 : 24000)
    ) {
      setNotice("This conversation is full. Start a new chat to continue.");
      return;
    }
    const id = retryId || crypto.randomUUID();
    const user = {
      id,
      role: "user",
      content,
      at: Date.now(),
      state: "pending",
    };
    setMessages([...prior, user]);
    setDraft("");
    setNotice("");
    setBusy(true);
    follow.current = true;
    const controller = new AbortController();
    request.current = controller;
    try {
      const reply = await sendAssistantMessage(
        content,
        history,
        controller.signal,
        scope,
      );
      if (controller.signal.aborted) return;
      setMessages([
        ...prior,
        { ...user, state: "sent" },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply,
          at: Date.now(),
          state: "sent",
        },
      ]);
      setStatus("AI responded");
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages([
          ...prior,
          { ...user, state: "error", error: chatError(error) },
        ]);
        setStatus("Response failed");
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
        input.current?.focus();
      }
    }
  }

  function stop() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setMessages((previous) =>
      previous.map((item) =>
        item.state === "pending"
          ? {
              ...item,
              state: "error",
              error: "Response stopped. Retry when ready.",
            }
          : item,
      ),
    );
  }
  function newChat() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setMessages([]);
    setDraft("");
    setNotice("");
    void refresh();
    input.current?.focus();
  }

 function trackScroll(){const el=scroll.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}
 return {trackScroll,messages,draft,setDraft,status,busy,notice,setNotice,scroll,input,send,stop,newChat,refresh,failed:messages.at(-1)?.state === "error"};
}
