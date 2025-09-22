// src/lib/GameLogic.ts
export type Role = "villager" | "werewolf" | "seer" | "doctor";

export interface Player {
  id: number;
  name: string;
  role: Role;
  alive: boolean;
}

export interface ChatMessage {
  id: number; // 0 = Narrator
  name: string;
  text: string;
}

/** Small AI message shape used when calling /api/ai */
export type AIMessage = { role: "system" | "assistant" | "user" | string; content: string };

/** Shuffle helper */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * callAI
 * Sends `messages` to your /api/ai route and attempts to read common response shapes.
 * Returns the assistant text (trimmed). Uses `unknown` for safe parsing.
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

  // Narrow safely
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // OpenAI-like: { choices: [ { message: { content } } ] }
    if ("choices" in obj && Array.isArray(obj.choices)) {
      const choices = obj.choices as unknown[];
      if (choices.length > 0 && typeof choices[0] === "object" && choices[0] !== null) {
        const first = choices[0] as Record<string, unknown>;
        if ("message" in first && typeof first.message === "object" && first.message !== null) {
          const msg = first.message as Record<string, unknown>;
          if (typeof msg.content === "string") return msg.content.trim();
        }
        if (typeof first.text === "string") return first.text.trim();
      }
    }

    // alternate shapes: { reply: "..." }
    if ("reply" in obj && typeof obj.reply === "string") return obj.reply.trim();

    // alternate shape: { result: [ { content: "..." } ] }
    if ("result" in obj && Array.isArray(obj.result) && obj.result.length > 0) {
      const r0 = obj.result[0] as Record<string, unknown>;
      if (typeof r0?.content === "string") return r0.content.trim();
    }
  }

  // Fallback if no usable content found
  return "…";
}

/* ---------------- Player initialization ---------------- */

const defaultNames = [
  "Henri",
  "Lucie",
  "Elise",
  "Antoine",
  "Jacques",
  "Colette",
  "Etienne",
  "Madeleine",
  "Pierre",
  "Sophie",
];

/** initializePlayers: randomize names and roles, return Player[] */
export function initializePlayers(): Player[] {
  const roles: Role[] = [
    "werewolf",
    "werewolf",
    "seer",
    "doctor",
    "villager",
    "villager",
    "villager",
    "villager",
    "villager",
    "villager",
  ];
  const shuffledNames = shuffle(defaultNames);
  const shuffledRoles = shuffle(roles);
  return shuffledNames.map((name, i) => ({
    id: i + 1,
    name,
    role: shuffledRoles[i],
    alive: true,
  }));
}
