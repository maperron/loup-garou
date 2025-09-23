// src/lib/prompts.ts
import { Player, ChatMessage } from "./game";

/* ---------------- Types ---------------- */
type AIMessage = { role: "system" | "assistant" | "user"; content: string };

type AIResponse = {
  choices?: { message?: { content?: string }; text?: string }[];
  reply?: string;
  result?: { content?: string }[];
};

/* ---------------- AI helper (typed) ---------------- */
export async function callAI(messages: AIMessage[]): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  let data: AIResponse;
  try {
    data = (await res.json()) as AIResponse;
  } catch {
    data = {};
  }

  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.reply ??
    data?.result?.[0]?.content ??
    "";

  return (content || "").toString().trim();
}

/* ---------------- small helpers ---------------- */
function roleInstruction(role: Player["role"]): string {
  switch (role) {
    case "werewolf":
      return "You are a werewolf. Work with your partner to choose one villager to kill at night. Hide your role and deflect suspicion.";
    case "seer":
      return "You are the Seer. You may know hidden information but hide it unless strategic.";
    case "doctor":
      return "You are the Doctor. Your priority is to survive. Bluff or defend to look like a villager.";
    default:
      return "You are a villager. Find and lynch werewolves. Use logic, bluff, or accusation to survive.";
  }
}

function chatSummary(chat: ChatMessage[], max = 5): string {
  if (!chat || chat.length === 0) return "none";
  return chat.slice(-max).map((m) => `${m.name}: ${m.text}`).join(" | ");
}

/* ---------------- Prompts ---------------- */

/** Villager/day prompt - returns a full system prompt string */
export function villagerPrompt(player: Player, players: Player[], chat: ChatMessage[]): string {
  const alive = players.filter((p) => p.alive).map((p) => p.name).join(", ");
  const dead = players.filter((p) => !p.alive).map((p) => p.name).join(", ") || "none";
  const recent = chatSummary(chat);

  return `
You are ${player.name} in the village of Havenwood.
Alive players: ${alive}
Dead players: ${dead}
Recent chat: ${recent}
Role guide: ${roleInstruction(player.role)}

Rules:
- It is DAY. Debate who might be werewolves.
- Speak like a human. Use 1-2 short sentences.
- Do not use commas or semicolons to extend sentences.
- Base reasoning only on what is in the recent chat.
- Do not invent events not mentioned in the chat.
`.trim();
}

/** Werewolf/night prompt - returns a full system prompt string */
export function werewolfPrompt(player: Player, players: Player[], wolfChat: ChatMessage[]): string {
  const villagers = players.filter((p) => p.alive && p.role !== "werewolf").map((p) => p.name).join(", ");
  const recent = chatSummary(wolfChat);

  return `
You are ${player.name}, secretly a werewolf in Havenwood.
Villagers alive: ${villagers}
Private wolf chat (recent): ${recent}

Task:
- It is NIGHT. Whisper with your partner to pick one villager to kill.
- Reply to your partner's last suggestion and help converge to one target.
- Show fear of exposure and a will to survive.

Rules:
- Use at most 1-2 short sentences.
- Do not use commas or semicolons to extend sentences.
- Do not reveal you are a werewolf.
`.trim();
}

/** Voting prompt - returns a full system prompt string */
export function votePrompt(voter: Player, accused: Player[], players: Player[], chat: ChatMessage[]): string {
  const options = accused.map((p) => p.name).join(", ");
  const alive = players.filter((p) => p.alive).map((p) => p.name).join(", ");
  const recent = chatSummary(chat);

  return `
You are ${voter.name} in Havenwood.
Alive players: ${alive}
Accused: ${options}
Recent chat: ${recent}

Task:
- Choose ONE name from the accused list above.
- Give a 1-2 sentence reason based on the recent chat.

Rules:
- Do not use commas or semicolons to extend sentences.
`.trim();
}
