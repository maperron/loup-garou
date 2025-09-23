"use client";

import { useEffect, useState, useRef } from "react";
import { initializePlayers, Player, ChatMessage } from "../lib/game";
import { startNight } from "../lib/night";
import { startDay } from "../lib/day";

export default function Page() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [wolfChat, setWolfChat] = useState<ChatMessage[]>([]);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"day" | "night">("night");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlayers(initializePlayers());
    setChat([{ id: 0, name: "Narrator", text: "Welcome to Havenwood. The game begins!" }]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // ------------------- NIGHT -------------------
  const handleNight = async () => {
    const { updatedPlayers } = await startNight(players, chat, round, (msg) => {
      if (msg.name.includes("(wolf whisper)")) {
        setWolfChat((prev) => [...prev, msg]);
      } else {
        setChat((prev) => [...prev, msg]);
      }
    });

    setPlayers(updatedPlayers); // apply deaths
    setPhase("day");
  };

  // ------------------- DAY -------------------
  const handleDay = async () => {
    const { updatedPlayers } = await startDay(players, chat, round, (msg) => {
      setChat((prev) => [...prev, msg]);
    });

    setPlayers(updatedPlayers);
    setPhase("night");
    setRound((r) => r + 1);
  };

  return (
    <main className="flex flex-col md:flex-row h-screen bg-gray-900 text-white font-sans">
      {/* Chat + Controls */}
      <section className="flex-1 flex flex-col border-r border-gray-700">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <h1 className="text-xl font-bold">🧑‍🤝‍🧑 Werewolf Game</h1>
          <span className="text-sm text-gray-300">
            {phase === "day" ? `☀️ Day ${round}` : `🌙 Night ${round}`}
          </span>
        </div>

        {/* Chat log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chat.map((m, idx) => (
            <div
              key={idx}
              className={`${
                m.name === "Narrator"
                  ? "text-gray-400 italic"
                  : "bg-gray-800 p-2 rounded-lg shadow"
              }`}
            >
              {m.name !== "Narrator" && (
                <span className="font-bold text-blue-400 mr-2">{m.name}:</span>
              )}
              <span>{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-800 border-t border-gray-700 flex gap-3 justify-center">
          {phase === "night" ? (
            <button
              onClick={handleNight}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg shadow"
            >
              Start Night
            </button>
          ) : (
            <button
              onClick={handleDay}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg shadow"
            >
              Start Day
            </button>
          )}
        </div>
      </section>

      {/* Players sidebar */}
      <aside className="w-full md:w-64 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700 text-lg font-semibold">Players</div>
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-700">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex justify-between items-center p-3 hover:bg-gray-700"
            >
              <span>{p.name}</span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  p.alive
                    ? "bg-green-600 text-white"
                    : "bg-red-600 text-white line-through"
                }`}
              >
                {p.alive ? "Alive" : "Dead"}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Werewolf sidebar */}
      <aside className="w-full md:w-64 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700 text-lg font-semibold">
          Werewolf Chat
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-700">
          {wolfChat.map((m, idx) => (
            <li key={idx} className="p-3">
              <span className="font-bold text-red-400">{m.name}:</span> {m.text}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
