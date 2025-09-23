// src/lib/night.ts
import { Player, ChatMessage, AIMessage, MessageCallback } from "./types";
import { werewolfPrompt } from "./prompts";
import { callAI } from "./ai";

/** internal werewolf speak helper that builds messages and calls the ai */
async function werewolfSpeak(player: Player, wolfChat: ChatMessage[], players: Player[]): Promise<string> {
  const messages: AIMessage[] = [
    { role: "system", content: werewolfPrompt(player, players, wolfChat) },
    ...wolfChat.map((m) => ({ role: "assistant", content: `${m.name}: ${m.text}` })),
    { role: "user", content: "You whisper to your partner. What do you say?" },
  ];
  return callAI(messages);
}

/** startNight orchestrates wolves and returns final players and nightChat */
export async function startNight(
  players: Player[],
  priorChat: ChatMessage[],
  round: number,
  onMessage?: MessageCallback
): Promise<{ updatedPlayers: Player[] }> {
  const playersCopy = players.map((p) => ({ ...p }));
  const wolves = playersCopy.filter((p) => p.alive && p.role === "werewolf");
  const villagers = playersCopy.filter((p) => p.alive && p.role !== "werewolf");

  const wolfChat: ChatMessage[] = []; // private wolf whispers

  // Narrator message visible to all
  const narratorStart: ChatMessage = { id: 0, name: "Narrator", text: `Night ${round} falls.` };
  if (onMessage) onMessage(narratorStart);

  let chosen: Player | null = null;

  const maxRounds = 4;
  for (let r = 0; r < maxRounds && !chosen; r++) {
    for (const wolf of wolves) {
      const reply = await werewolfSpeak(wolf, wolfChat, playersCopy);

      // Append to private wolf chat
      const whisperMsg: ChatMessage = { id: wolf.id, name: `${wolf.name} (wolf whisper)`, text: reply };
      wolfChat.push({ id: wolf.id, name: wolf.name, text: reply });
      if (onMessage) onMessage(whisperMsg);

      // Determine target
      for (const v of villagers) {
        const mentions = wolfChat.filter((m) => m.text.toLowerCase().includes(v.name.toLowerCase()));
        const mentioners = new Set(mentions.map((m) => m.name));
        if (mentioners.size >= wolves.length && mentions.length >= wolves.length) {
          chosen = v;
          break;
        }
      }
      if (chosen) break;
    }
  }

  if (!chosen && villagers.length > 0) {
    chosen = villagers[Math.floor(Math.random() * villagers.length)];
    const narratorFail: ChatMessage = { id: 0, name: "Narrator", text: `Werewolves could not agree. They pick ${chosen.name}.` };
    if (onMessage) onMessage(narratorFail);
  }

  if (chosen) {
    // Apply death
    for (const p of playersCopy) if (p.name === chosen!.name) p.alive = false;
    const narratorDeath: ChatMessage = { id: 0, name: "Narrator", text: `${chosen.name} was killed during the night!` };
    if (onMessage) onMessage(narratorDeath);
  }

  return { updatedPlayers: playersCopy };
}


