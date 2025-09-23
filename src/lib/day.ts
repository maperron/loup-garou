// src/lib/day.ts
import { Player, ChatMessage, AIMessage, MessageCallback } from "./types";
import { villagerPrompt, votePrompt } from "./prompts";
import { callAI } from "./ai";
import { shuffle, isAccusation, chatAsAssistantMessages } from "./utils";

/** ask model what a player says during day */
export async function aiSpeak(player: Player, chat: ChatMessage[], players: Player[]): Promise<string> {
  const messages: AIMessage[] = [
    { role: "system", content: villagerPrompt(player, players, chat) },
    ...chatAsAssistantMessages(chat),
    { role: "user", content: `It's ${player.name}'s turn. What do you say now?` },
  ];
  return callAI(messages);
}

/** voting helper */
export async function aiVote(voter: Player, accused: Player[], chat: ChatMessage[], players: Player[]): Promise<string> {
  const messages: AIMessage[] = [
    { role: "system", content: votePrompt(voter, accused, players, chat) },
    ...chatAsAssistantMessages(chat),
    { role: "user", content: "Who do you vote for and why?" },
  ];
  return callAI(messages);
}

/** startDay: discussion -> defense -> voting */
export async function startDay(
  players: Player[],
  priorChat: ChatMessage[],
  round: number,
  onMessage?: MessageCallback
): Promise<{ updatedPlayers: Player[] }> {
  const playersCopy = players.map((p) => ({ ...p }));

  // Narrator message
  const narratorStart: ChatMessage = { id: 0, name: "Narrator", text: `Day ${round} begins. Discuss and accuse.` };
  if (onMessage) onMessage(narratorStart);

  const order = shuffle(playersCopy.filter((p) => p.alive));
  const accusedSet = new Set<string>();

  // Discussion
  for (const speaker of order) {
    const reply = await aiSpeak(speaker, [], playersCopy); // pass empty chat; messages stream via onMessage
    const entry: ChatMessage = { id: speaker.id, name: speaker.name, text: reply };
    if (onMessage) onMessage(entry);

    // detect accusations
    for (const t of playersCopy) {
      if (t.alive && t.name !== speaker.name && isAccusation(reply, t.name)) accusedSet.add(t.name);
    }
  }

  // Defend & vote
  const accusedPlayers = playersCopy.filter((p) => accusedSet.has(p.name));
  if (accusedPlayers.length > 0) {
    const narratorAccused: ChatMessage = { id: 0, name: "Narrator", text: `Accused: ${accusedPlayers.map((p) => p.name).join(", ")}.` };
    if (onMessage) onMessage(narratorAccused);

    for (const acc of accusedPlayers) {
      const defense = await aiSpeak(acc, [], playersCopy);
      const entry: ChatMessage = { id: acc.id, name: acc.name, text: defense };
      if (onMessage) onMessage(entry);
    }

    const narratorVoting: ChatMessage = { id: 0, name: "Narrator", text: "Voting begins now." };
    if (onMessage) onMessage(narratorVoting);

    const votes: Record<string, number> = {};
    for (const voter of playersCopy.filter((p) => p.alive)) {
      const choiceText = await aiVote(voter, accusedPlayers, [], playersCopy);
      const entry: ChatMessage = { id: voter.id, name: voter.name, text: choiceText };
      if (onMessage) onMessage(entry);

      const picked = accusedPlayers.find((a) => choiceText.toLowerCase().includes(a.name.toLowerCase()));
      const final = picked ?? accusedPlayers[Math.floor(Math.random() * accusedPlayers.length)];
      votes[final.name] = (votes[final.name] || 0) + 1;
    }

    const max = Math.max(...Object.values(votes));
    const top = Object.keys(votes).filter((n) => votes[n] === max);
    const lynched = top.length === 1 ? top[0] : top[Math.floor(Math.random() * top.length)];
    playersCopy.forEach((p) => { if (p.name === lynched) p.alive = false; });

    const narratorLynch: ChatMessage = { id: 0, name: "Narrator", text: `${lynched} was lynched by vote.` };
    if (onMessage) onMessage(narratorLynch);
  } else {
    const narratorNo: ChatMessage = { id: 0, name: "Narrator", text: "No one was strongly accused today." };
    if (onMessage) onMessage(narratorNo);
  }

  return { updatedPlayers: playersCopy };
}

