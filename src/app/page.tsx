// src/app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  initializePlayers,
  startNight,
  startDay,
  Player,
  ChatMessage,
} from "../lib/GameLogic";

export default function Page() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPlayers(initializePlayers());
    setChat([]);
    setRound(1);
  }, []);

  async function handleNight() {
    if (!players.length) return;
    setLoading(true);
    const { updatedPlayers, nightChat } = await startNight(players, chat, round);
    setPlayers(updatedPlayers);
    setChat(nightChat);
    setLoading(false);
  }

  async function handleDay() {
    if (!players.length) return;
    setLoading(true);
    const { updatedPlayers, updatedChat } = await startDay(players, chat, round);
    setPlayers(updatedPlayers);
    setChat(updatedChat);
    setRound((r) => r + 1);
    setLoading(false);
  }

  // simple circle layout math
  const radius = 220;
  const centerX = 50; // using translate for absolute positions
  const centerY = 50;

  return (
    <main className="flex min-h-screen bg-green-900 text-white">
      <div className="flex-1 relative flex items-center justify-center p-8">
        {/* circle of players */}
        <div className="relative w-[700px] h-[700px]">
          {players.map((p, i) => {
            const angle = (i / players.length) * Math.PI * 2;
            const x = 320 + radius * Math.cos(angle) - 40;
            const y = 320 + radius * Math.sin(angle) - 40;
            return (
              <div
                key={p.id}
                title={`${p.name} (${p.role})`}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  backgroundColor: p.alive ? "#fbbf24" : "#4b5563",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "3px solid white",
                }}
              >
                <span className="text-xs font-bold text-black">{p.name}</span>
              </div>
            );
          })}

          <div
            style={{
              position: "absolute",
              left: 320 - 60,
              top: 320 - 60,
              width: 120,
              height: 120,
              borderRadius: "50%",
              backgroundColor: "#1f2937",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid white",
            }}
          >
            Narrator
          </div>
        </div>

        {/* controls */}
        <div className="absolute bottom-8 left-8 flex flex-col gap-2">
          <button
            onClick={handleNight}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 rounded disabled:opacity-50"
          >
            {loading ? "Thinking..." : `Start Night ${round}`}
          </button>
          <button
            onClick={handleDay}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 rounded disabled:opacity-50"
          >
            {loading ? "Thinking..." : `Start Day ${round}`}
          </button>
        </div>
      </div>

      <div className="w-1/3 bg-gray-800 p-4 overflow-y-auto max-h-screen">
        <h2 className="text-xl font-bold mb-2">Chat Log</h2>
        <div className="space-y-3 text-sm">
          {chat.map((m, i) => (
            <div key={i} className="border-b border-gray-700 pb-2">
              <b>{m.name}:</b> <span className="ml-2">{m.text}</span>
            </div>
          ))}
        </div>
        {loading && <div className="mt-3 text-gray-400">AI thinking…</div>}
      </div>
    </main>
  );
}
