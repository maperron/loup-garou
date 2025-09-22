// src/app/page.tsx
"use client";

import React, { useState } from "react";
import { Player, ChatMessage, initializePlayers } from "../lib/GameLogic";
import { startDay } from "../lib/DayLogic";
import { startNight } from "../lib/NightLogic";

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>(() => initializePlayers());
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [round, setRound] = useState<number>(1);
  const [phase, setPhase] = useState<"night" | "day">("night");
  const [running, setRunning] = useState<boolean>(false);

  async function nextPhase() {
    if (running) return;
    setRunning(true);

    if (phase === "night") {
      const { updatedPlayers, nightChat } = await startNight(players, chat, round);
      setPlayers(updatedPlayers);
      setChat(nightChat);
      setPhase("day");
    } else {
      const { updatedPlayers, updatedChat } = await startDay(players, chat, round);
      setPlayers(updatedPlayers);
      setChat(updatedChat);
      setPhase("night");
      setRound((r) => r + 1);
    }

    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-4">Loup Garou — Havenwood</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={nextPhase}
          disabled={running}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {running ? "Running..." : `Next (${phase === "night" ? "Night" : "Day"})`}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-5xl">
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-xl font-semibold mb-2">Players</h2>
          <ul className="space-y-1">
            {players.map((p) => (
              <li
                key={p.id}
                className={`flex justify-between px-2 py-1 rounded ${
                  p.alive ? "bg-green-100" : "bg-red-200"
                }`}
              >
                <span>{p.name}</span>
                <span className="text-sm">{p.alive ? "Alive" : "Dead"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white shadow rounded p-4">
          <h2 className="text-xl font-semibold mb-2">Chat</h2>
          <div className="h-[70vh] overflow-y-auto space-y-2">
            {chat.map((m, idx) => (
              <div key={idx} className="p-2 rounded bg-gray-50">
                <strong>{m.name}:</strong> {m.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
