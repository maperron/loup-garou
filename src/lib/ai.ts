// src/lib/ai.ts
import { AIMessage } from "./types";

/**
 * callAI: send array of AIMessage to /api/ai. Parse common shapes safely.
 * Returns the raw assistant string (trimmed). Uses 'unknown' parsing.
 */
export async function callAI(messages: AIMessage[]): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = {};
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // check OpenAI-like shape: choices[0].message.content
    if ("choices" in obj && Array.isArray(obj.choices) && obj.choices.length > 0) {
      const first = (obj.choices as unknown[])[0] as Record<string, unknown>;
      if ("message" in first && typeof first.message === "object" && first.message !== null) {
        const msg = first.message as Record<string, unknown>;
        if (typeof msg.content === "string") return msg.content.trim();
      }
      if (typeof first.text === "string") return first.text.trim();
    }

    // other shapes
    if ("reply" in obj && typeof obj.reply === "string") return obj.reply.trim();
    if ("result" in obj && Array.isArray(obj.result) && obj.result.length > 0) {
      const r0 = obj.result[0] as Record<string, unknown>;
      if (typeof r0?.content === "string") return r0.content.trim();
    }
  }

  // fallback
  return "…";
}
