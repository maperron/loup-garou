// src/lib/game.ts
import { shuffle } from "./utils";

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
