// src/lib/DayLogic.ts
import { Player, ChatMessage, callAI, shuffle } from "./GameLogic";
import { villagerPrompt, votePrompt } from "./Prompts";

/** a compact suspicion-word based accusation detector */
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

function isAccusation(text: string, target: string) {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (!lower.includes(target.toLowerCase())) return false;
  return suspicionWords.some((w) => lower.includes(w));
}

/** ask the LLM what a player says during the day */
export async function aiSpeak(player: Player, chat: ChatMessage[], players: Player[]): Promise<string> {
  const messages = [
    { role: "system", content: villagerPrompt(player, players, chat) },
    ...chat.map((m) => ({ role: "assistant", content: `${m.name}: ${m.text}` })),
    { role: "user", content: `It's ${player.name}'s turn. What do you say now?` },
  ];
  return callAI(messages);
}

/** ask the LLM who a voter chooses among accused */
export async function aiVote(voter: Player, accused: Player[], chat: ChatMessage[], players: Player[]): Promise<string> {
  const messages = [
    { role: "system", content: votePrompt(voter, accused, players, chat) },
    ...chat.map((m) => ({ role: "assistant", content: `${m.name}: ${m.text}` })),
    { role: "user", content: "Who do you vote for and why?" },
  ];
  return callAI(messages);
}

/** startDay: run discussion, collect accusations, defenses, votes and resolve lynch */
export async function startDay(
  players: Player[],
  priorChat: ChatMessage[],
  round: number
): Promise<{ updatedPlayers: Player[]; updatedChat: ChatMessage[] }> {
  const playersCopy = players.map((p) => ({ ...p }));
  const updatedChat: ChatMessage[] = [
    ...priorChat,
    { id: 0, name: "Narrator", text: `Day ${round} begins. Discuss and accuse.` },
  ];

  const order = shuffle(playersCopy.filter((p) => p.alive));
  const accusedSet = new Set<string>();

  // discussion
  for (const speaker of order) {
    const reply = await aiSpeak(speaker, updatedChat, playersCopy);
    updatedChat.push({ id: speaker.id, name: speaker.name, text: reply });

    for (const t of playersCopy) {
      if (t.alive && t.name !== speaker.name && isAccusation(reply, t.name)) accusedSet.add(t.name);
    }
  }

  // defense & voting
  const accusedPlayers = playersCopy.filter((p) => accusedSet.has(p.name));
  if (accusedPlayers.length > 0) {
    updatedChat.push({ id: 0, name: "Narrator", text: `Accused: ${accusedPlayers.map((p) => p.name).join(", ")}.` });

    // defense
    for (const acc of accusedPlayers) {
      const defense = await aiSpeak(acc, updatedChat, playersCopy);
      updatedChat.push({ id: acc.id, name: acc.name, text: defense });
    }

    // voting
    updatedChat.push({ id: 0, name: "Narrator", text: "Voting begins now." });
    const votes: Record<string, number> = {};

    for (const voter of playersCopy.filter((p) => p.alive)) {
      const choiceText = await aiVote(voter, accusedPlayers, updatedChat, playersCopy);
      updatedChat.push({ id: voter.id, name: voter.name, text: choiceText });

      const picked = accusedPlayers.find((a) => choiceText.toLowerCase().includes(a.name.toLowerCase()));
      const final = picked ?? accusedPlayers[Math.floor(Math.random() * accusedPlayers.length)];
      votes[final.name] = (votes[final.name] || 0) + 1;
    }

    // resolve lynch
    const maxVotes = Math.max(...Object.values(votes));
    const top = Object.keys(votes).filter((n) => votes[n] === maxVotes);
    const lynched = top.length === 1 ? top[0] : top[Math.floor(Math.random() * top.length)];
    for (const p of playersCopy) if (p.name === lynched) p.alive = false;
    updatedChat.push({ id: 0, name: "Narrator", text: `${lynched} was lynched by vote.` });
  } else {
    updatedChat.push({ id: 0, name: "Narrator", text: "No one was strongly accused today." });
  }

  return { updatedPlayers: playersCopy, updatedChat };
}
