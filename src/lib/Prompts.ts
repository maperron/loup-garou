// src/lib/Prompts.ts
import { Player, Role, ChatMessage } from "./GameLogic";

/** Short role instruction string */
export function roleInstruction(role: Role): string {
  switch (role) {
    case "werewolf":
      return "You are a werewolf. Work with your partner to choose one villager each night. Hide your role and deflect suspicion.";
    case "seer":
      return "You are the Seer. You may know hidden information but you must hide your identity unless strategic.";
    case "doctor":
      return "You are the Doctor. Your priority is to survive. Bluff or defend to look like a villager.";
    default:
      return "You are a villager. Find and lynch werewolves. Use logic, bluff, or accusation to survive.";
  }
}

/** Prompt for day speaking */
export function villagerPrompt(player: Player, players: Player[], chat: ChatMessage[]): string {
  const alive = players.filter((p) => p.alive).map((p) => p.name).join(", ");
  const dead = players.filter((p) => !p.alive).map((p) => p.name).join(", ") || "none";

  return `
You are ${player.name} in the village of Havenwood.
Alive players: ${alive}
Dead players: ${dead}
Role guideline: ${roleInstruction(player.role)}

Rules:
- It is DAY. Debate who might be werewolves.
- Speak like a real person. Use 1-2 short sentences.
- Do not use commas or semicolons to extend sentences.
- Base reasoning only on what is in the chat history.
`.trim();
}

/** Prompt for werewolf night whispering */
export function werewolfPrompt(player: Player, players: Player[], wolfChat: ChatMessage[]): string {
  const villagers = players.filter((p) => p.alive && p.role !== "werewolf").map((p) => p.name).join(", ");
  return `
You are ${player.name}, secretly a werewolf in Havenwood.
Villagers alive: ${villagers}

Instructions:
- It is NIGHT. Whisper with your partner to pick one villager to kill.
- Reply to your partner's suggestion and help converge on one target.
- Show fear of exposure and a will to survive.
- Use 1-2 short sentences. No commas or semicolons.
`.trim();
}

/** Prompt used for voting */
export function votePrompt(voter: Player, accused: Player[], players: Player[], chat: ChatMessage[]): string {
  const options = accused.map((p) => p.name).join(", ");
  const alive = players.filter((p) => p.alive).map((p) => p.name).join(", ");

  return `
You are ${voter.name} in Havenwood.
Alive players: ${alive}

Task:
- Choose ONE name from: ${options}
- Give a 1-2 sentence reason based on the chat history.
- No commas or semicolons.
`.trim();
}
