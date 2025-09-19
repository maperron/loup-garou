// src/lib/GameLogic.ts
export type Role = "villager" | "werewolf" | "seer" | "doctor";

export interface Player {
  id: number;
  name: string;
  role: Role;
  alive: boolean;
}

export interface ChatMessage {
  id: number; // player id (0 for narrator)
  name: string;
  text: string;
}

/* ----------------- Utilities ----------------- */

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeRegExp(s: string) {
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

export function isAccusation(text: string, targetName: string) {
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

/* ----------------- AI call helper -----------------
   Sends structured messages to your /api/ai route.
   The route is expected to forward messages to the LLM.
   Returns the assistant content string.
--------------------------------------------------*/
async function callAI(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json().catch(() => ({} as any));

  // Try a few common fields for different API shapes
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.reply ??
    data?.result?.[0]?.content ??
    "";
  return (content || "").toString().trim();
}

/* ----------------- Player initialization ----------------- */

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

export function initializePlayers(): Player[] {
  // role pool: 2 werewolves, 1 seer, 1 doctor, rest villagers
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

/* ----------------- Role instruction snips ----------------- */
function roleInstruction(role: Role): string {
  switch (role) {
    case "werewolf":
      return "You are a werewolf. Work with your partner to choose one villager to kill at night. Hide your role. Deflect suspicion. Survive.";
    case "seer":
      return "You are the Seer. You may know hidden information but must not reveal it unless strategic. Survive.";
    case "doctor":
      return "You are the Doctor. Your priority is to survive. Bluff or defend to look like a villager.";
    default:
      return "You are a villager. Find and lynch werewolves. Use logic, emotion, bluff, or accusation to survive.";
  }
}

/* ----------------- AI-facing speech functions ----------------- */

/**
 * Villager/day speech
 */
export async function aiSpeak(
  player: Player,
  contextChat: ChatMessage[],
  playersSnapshot: Player[]
): Promise<string> {
  const aliveNames = playersSnapshot.filter((p) => p.alive).map((p) => p.name).join(", ");
  const deadNames = playersSnapshot.filter((p) => !p.alive).map((p) => p.name).join(", ") || "none";

  const systemPrompt = `
You are ${player.name} in the village of Havenwood.
Context:
- Alive players: ${aliveNames}
- Dead players: ${deadNames}
- Role instruction: ${roleInstruction(player.role)}

Task & tone:
- It is DAY. Debate who the werewolves might be.
- You may accuse, defend, lie, bluff, or tell a short story for cover.
- Base your reasoning on what was actually said in the chat.
- Act human. Use short, natural sentences.
- Stop after at most 2 sentences.
- Do not use commas or semicolons to extend sentences.
- Do not invent events not mentioned in chat.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    // pass chat as assistant-role lines so the model sees the conversation
    ...contextChat.map((m) => ({ role: "assistant", content: `${m.name}: ${m.text}` })),
    { role: "user", content: `It's ${player.name}'s turn. What do you say now?` },
  ];

  const out = await callAI(messages);
  return out;
}

/**
 * Werewolf/night speech - scoped only to werewolf conversation
 */
export async function werewolfSpeak(
  player: Player,
  wolfChat: ChatMessage[],
  playersSnapshot: Player[]
): Promise<string> {
  const villagers = playersSnapshot.filter((p) => p.alive && p.role !== "werewolf").map((p) => p.name).join(", ");

  const systemPrompt = `
You are ${player.name}. You are secretly a werewolf in Havenwood.
Context:
- Villagers alive: ${villagers}
Task:
- Night. Whisper to your partner to agree on one villager to kill.
- Reply to what the partner just suggested. Work as a team.
- Show fear of being caught and a drive to survive.
Rules:
- Stop after at most 2 sentences.
- Do not use commas or semicolons to extend sentences.
- Do not reveal you are a werewolf.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...wolfChat.map((m) => ({ role: "assistant", content: `${m.name}: ${m.text}` })),
    { role: "user", content: `You whisper to your fellow werewolf. What do you say?` },
  ];

  const out = await callAI(messages);
  return out;
}

/**
 * Voting helper - choose someone from the accused list (used during day voting)
 */
export async function aiVote(
  voter: Player,
  accused: Player[],
  contextChat: ChatMessage[],
  playersSnapshot: Player[]
): Promise<string> {
  const options = accused.map((p) => p.name).join(", ");
  const aliveNames = playersSnapshot.filter((p) => p.alive).map((p) => p.name).join(", ");

  const systemPrompt = `
You are ${voter.name} in Havenwood.
Alive: ${aliveNames}
Task:
- Choose one name from: ${options}
- Give a 1-2 sentence reason based on the chat.
Rules:
- Stop after at most 2 sentences.
- Do not use commas or semicolons to extend sentences.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...contextChat.map((m) => ({ role: "assistant", content: `${m.name}: ${m.text}` })),
    { role: "user", content: "Who do you vote to eliminate and why?" },
  ];

  const out = await callAI(messages);
  return out;
}

/* ----------------- Night and Day orchestration ----------------- */

/**
 * startNight:
 * - conducts a werewolf-only back-and-forth (wolfChat) visible to dev via the chat return
 * - stops early if both wolves mention same villager (consensus)
 * - kills chosen target immediately and returns updated players + new chat
 */
export async function startNight(
  players: Player[],
  priorChat: ChatMessage[],
  round: number
): Promise<{ updatedPlayers: Player[]; nightChat: ChatMessage[] }> {
  // copy players so we don't mutate caller's array
  const playersCopy = players.map((p) => ({ ...p }));
  const aliveWolves = playersCopy.filter((p) => p.alive && p.role === "werewolf");
  const villagers = playersCopy.filter((p) => p.alive && p.role !== "werewolf");

  let wolfChat: ChatMessage[] = [];
  const nightChat: ChatMessage[] = [
    ...priorChat,
    { id: 0, name: "Narrator", text: `Night ${round} falls. Werewolves whisper.` },
  ];

  let chosenTarget: Player | null = null;

  // back-and-forth: up to 8 iterations total (each wolf speaks each iteration)
  const maxOuter = 4;
  for (let r = 0; r < maxOuter && !chosenTarget; r++) {
    for (const wolf of aliveWolves) {
      const reply = await werewolfSpeak(wolf, wolfChat, playersCopy);
      const entry = { id: wolf.id, name: `${wolf.name} (wolf whisper)`, text: reply };
      wolfChat.push({ id: wolf.id, name: wolf.name, text: reply }); // internal wolf chat
      nightChat.push(entry); // visible in UI for debug/dev

      // check if both wolves have mentioned the same villager
      for (const v of villagers) {
        const mentions = wolfChat.filter((m) =>
          m.text.toLowerCase().includes(v.name.toLowerCase())
        );
        const uniqueMentioners = new Set(mentions.map((m) => m.name.toLowerCase()));
        // uniqueMentioners size equals number of wolves -> consensus
        if (uniqueMentioners.size >= aliveWolves.length) {
          chosenTarget = v;
          break;
        }
      }
      if (chosenTarget) break;
    }
  }

  // fallback random
  if (!chosenTarget) {
    const options = playersCopy.filter((p) => p.alive && p.role !== "werewolf");
    if (options.length === 0) {
      // nothing to kill
    } else {
      chosenTarget = options[Math.floor(Math.random() * options.length)];
      nightChat.push({
        id: 0,
        name: "Narrator",
        text: `Werewolves could not agree. They pick ${chosenTarget.name}.`,
      });
    }
  }

  if (chosenTarget) {
    // mark dead
    for (const p of playersCopy) {
      if (p.name === chosenTarget.name) p.alive = false;
    }
    nightChat.push({
      id: 0,
      name: "Narrator",
      text: `${chosenTarget.name} was killed during the night!`,
    });
  }

  return { updatedPlayers: playersCopy, nightChat };
}

/**
 * startDay:
 * - runs through alive players, each gives a short message (aiSpeak)
 * - detects accused players
 * - each accused gets one defense turn
 * - voting phase: all alive players vote among accused (aiVote)
 * - resolves lynch (highest votes; tie -> random among top)
 */
export async function startDay(
  players: Player[],
  priorChat: ChatMessage[],
  round: number
): Promise<{ updatedPlayers: Player[]; updatedChat: ChatMessage[] }> {
  const playersCopy = players.map((p) => ({ ...p }));
  let updatedChat: ChatMessage[] = [
    ...priorChat,
    { id: 0, name: "Narrator", text: `Day ${round} begins. Discuss and accuse.` },
  ];

  const alivePlayers = playersCopy.filter((p) => p.alive);
  // speaking order: shuffle to keep it dynamic
  const order = shuffle(alivePlayers);

  const accusedSet = new Set<string>();

  // Discussion phase
  for (const speaker of order) {
    const snapshot = [...updatedChat];
    const reply = await aiSpeak(speaker, snapshot, playersCopy);
    updatedChat.push({ id: speaker.id, name: speaker.name, text: reply });

    // detect accusation(s) in this reply
    for (const target of playersCopy) {
      if (target.alive && target.name !== speaker.name && isAccusation(reply, target.name)) {
        accusedSet.add(target.name);
      }
    }
  }

  // Defense phase: each accused defends once
  const accusedPlayers = playersCopy.filter((p) => accusedSet.has(p.name));
  if (accusedPlayers.length > 0) {
    updatedChat.push({
      id: 0,
      name: "Narrator",
      text: `Accused: ${accusedPlayers.map((p) => p.name).join(", ")}.`,
    });

    for (const accused of accusedPlayers) {
      const defense = await aiSpeak(accused, updatedChat, playersCopy);
      updatedChat.push({ id: accused.id, name: accused.name, text: defense });
    }

    // Voting phase
    updatedChat.push({ id: 0, name: "Narrator", text: "Voting begins now." });
    const votes: Record<string, number> = {};
    for (const voter of playersCopy.filter((p) => p.alive)) {
      const choiceText = await aiVote(voter, accusedPlayers, updatedChat, playersCopy);
      updatedChat.push({ id: voter.id, name: voter.name, text: choiceText });

      const picked = accusedPlayers.find((a) => choiceText.toLowerCase().includes(a.name.toLowerCase()));
      if (picked) {
        votes[picked.name] = (votes[picked.name] || 0) + 1;
      } else {
        // if AI did not clearly mention a name, choose random from accused
        const fallback = accusedPlayers[Math.floor(Math.random() * accusedPlayers.length)];
        votes[fallback.name] = (votes[fallback.name] || 0) + 1;
      }
    }

    // find top vote(s)
    let max = 0;
    let tops: string[] = [];
    for (const [name, count] of Object.entries(votes)) {
      if (count > max) {
        max = count;
        tops = [name];
      } else if (count === max) {
        tops.push(name);
      }
    }

    if (tops.length === 0) {
      updatedChat.push({ id: 0, name: "Narrator", text: "No votes were cast. No lynch today." });
    } else {
      const lynchedName = tops.length === 1 ? tops[0] : tops[Math.floor(Math.random() * tops.length)];
      // mark dead
      for (const p of playersCopy) {
        if (p.name === lynchedName) p.alive = false;
      }
      updatedChat.push({ id: 0, name: "Narrator", text: `${lynchedName} was lynched by vote.` });
    }
  } else {
    updatedChat.push({ id: 0, name: "Narrator", text: "No one was strongly accused today." });
  }

  return { updatedPlayers: playersCopy, updatedChat };
}
