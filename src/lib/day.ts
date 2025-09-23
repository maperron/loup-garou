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
): Promise<{ updatedPlayers: Player[]; updatedChat: ChatMessage[] }> {
  const playersCopy = players.map((p) => ({ ...p }));
  const updatedChat: ChatMessage[] = [...priorChat, { id: 0, name: "Narrator", text: `Day ${round} begins. Discuss and accuse.` }];
  if (onMessage) onMessage(updatedChat[updatedChat.length - 1]);

  const order = shuffle(playersCopy.filter((p) => p.alive));
  const accusedSet = new Set<string>();

  // Discussion
  for (const speaker of order) {
    const reply = await aiSpeak(speaker, updatedChat, playersCopy);
    const entry = { id: speaker.id, name: speaker.name, text: reply };
    updatedChat.push(entry);
    if (onMessage) onMessage(entry);

    // detect accusations
    for (const t of playersCopy) {
      if (t.alive && t.name !== speaker.name && isAccusation(reply, t.name)) accusedSet.add(t.name);
    }
  }

  // Defend & vote
  const accusedPlayers = playersCopy.filter((p) => accusedSet.has(p.name));
  if (accusedPlayers.length > 0) {
    const narrator = { id: 0, name: "Narrator", text: `Accused: ${accusedPlayers.map((p) => p.name).join(", ")}.` };
    updatedChat.push(narrator);
    if (onMessage) onMessage(narrator);

    for (const acc of accusedPlayers) {
      const defense = await aiSpeak(acc, updatedChat, playersCopy);
      const entry = { id: acc.id, name: acc.name, text: defense };
      updatedChat.push(entry);
      if (onMessage) onMessage(entry);
    }

    // Voting
    const narrator2 = { id: 0, name: "Narrator", text: "Voting begins now." };
    updatedChat.push(narrator2);
    if (onMessage) onMessage(narrator2);

    const votes: Record<string, number> = {};
    for (const voter of playersCopy.filter((p) => p.alive)) {
      const choiceText = await aiVote(voter, accusedPlayers, updatedChat, playersCopy);
      const entry = { id: voter.id, name: voter.name, text: choiceText };
      updatedChat.push(entry);
      if (onMessage) onMessage(entry);

      const picked = accusedPlayers.find((a) => choiceText.toLowerCase().includes(a.name.toLowerCase()));
      const final = picked ?? accusedPlayers[Math.floor(Math.random() * accusedPlayers.length)];
      votes[final.name] = (votes[final.name] || 0) + 1;
    }

    // resolve
    const max = Math.max(...Object.values(votes));
    const top = Object.keys(votes).filter((n) => votes[n] === max);
    const lynched = top.length === 1 ? top[0] : top[Math.floor(Math.random() * top.length)];
    playersCopy.forEach((p) => { if (p.name === lynched) p.alive = false; });
    const narrator3 = { id: 0, name: "Narrator", text: `${lynched} was lynched by vote.` };
    updatedChat.push(narrator3);
    if (onMessage) onMessage(narrator3);
  } else {
    const narratorNo = { id: 0, name: "Narrator", text: "No one was strongly accused today." };
    updatedChat.push(narratorNo);
    if (onMessage) onMessage(narratorNo);
  }

  return { updatedPlayers: playersCopy, updatedChat };
}
