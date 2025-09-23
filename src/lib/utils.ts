// src/lib/utils.ts
import { ChatMessage } from "./types";

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const suspicionWords = [
  "suspect",
  "guilty",
  "wolf",
  "liar",
  "blame",
  "accuse",
  "hide",
  "suspicious",
  "sketchy",
  "shady",
  "lying",
  "kill",
  "vote",
];

/** basic accusation detector used in your game */
export function isAccusation(text: string, targetName: string): boolean {
  if (!text || !targetName) return false;
  const lower = text.toLowerCase();
  const nameRegex = new RegExp(`\\b${escapeRegExp(targetName.toLowerCase())}\\b`, "i");
  if (!nameRegex.test(lower)) return false;
  const words = lower.split(/\s+/);
  const idx = words.findIndex((w) => w.includes(targetName.toLowerCase()));
  if (idx === -1) return false;
  const window = words.slice(Math.max(0, idx - 5), Math.min(words.length, idx + 5));
  return suspicionWords.some((sw) => window.includes(sw));
}

/** optional small sanitizer: remove extra commas/semicolons and limit to N sentences.
 *  Disabled by default; you can call if you want strict enforcement.
 */
export function sanitizeResponse(raw: string, maxSentences = 2, removeCommaSemicolon = false): string {
  if (!raw) return raw;
  let text = raw.trim();
  if (removeCommaSemicolon) {
    text = text.replace(/[;,]/g, "");
  }
  // split sentences by ., !, ?
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= maxSentences) return text;
  return sentences.slice(0, maxSentences).join(" ").trim();
}

/** helper to convert ChatMessage[] into assistant messages for the LLM */
export function chatAsAssistantMessages(currentChat: ChatMessage[]) {
  return currentChat.map((c) => ({ role: "assistant" as const, content: `${c.name}: ${c.text}` }));
}
