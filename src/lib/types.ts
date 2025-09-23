// src/lib/types.ts
export type Role = "villager" | "werewolf" | "seer" | "doctor";

export interface Player {
  id: number;
  name: string;
  role: Role;
  alive: boolean;
}

export interface ChatMessage {
  id: number; // 0 = narrator
  name: string;
  text: string;
}

/** message shape sent to /api/ai */
export type AIMessage = { role: "system" | "assistant" | "user" | string; content: string };

/** callback used to stream messages into the UI as they're generated */
export type MessageCallback = (msg: ChatMessage) => void;
