import { readableChatText } from "./chat-text.mjs";
import axiosClient from "@/axios-client";

export async function checkAssistant(signal, scope = "internal") {
  const { data } = await axiosClient.get(scope === "public" ? "/public/ai-health" : "/ai/health", { signal, timeout: 8000, handleErrorsLocally: true });
  return data;
}

export async function sendAssistantMessage(message, history, signal, scope = "internal") {
  const { data } = await axiosClient.post(scope === "public" ? "/public/chat" : "/ai/chat", { message, history }, { signal, timeout: 45000, handleErrorsLocally: true });
  if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("The assistant returned an empty response.");
  const reply = readableChatText(data.reply);
  if (!reply) throw new Error("The assistant returned an empty response.");
  return reply;
}

export function chatError(error) {
  if (error.response?.status === 429) return "The assistant is busy. Wait a moment, then retry.";
  if (error.response?.status === 422) return "The conversation is too long or invalid. Shorten the message or start a new chat.";
  if (error.response?.status === 401) return "Your session expired. Please sign in again.";
  if (error.response?.status === 403) return "Your account cannot access the assistant.";
  return "The assistant could not respond. Check the AI service, then retry.";
}
