"use client";

import { useEffect, useRef, useState } from "react";
import useGameLoop from "./useGameLoop";
import LoadingScreen from "./LoadingScreen";
import {
  isGamePaused,
  isAudioEnabled,
  initYouTubeSDK,
  saveGameData,
  sendScore,
  notifyGameReady,
} from "./youtubeSdk";

export default function GameCanvas() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [time, setTime] = useState(30);
  const [box, setBox] = useState({ x: 50, y: 50 });
  const [isLoading, setIsLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [ytAudioEnabled, setYtAudioEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const isSoundAllowed = soundEnabled && ytAudioEnabled;

  // 🔊 Sounds
  const clickSound = useRef(null);
  const gameOverSound = useRef(null);

  useEffect(() => {
    clickSound.current = new Audio("/sounds/click.mp3");
    gameOverSound.current = new Audio("/sounds/game-over.mp3");
  }, []);

  useEffect(() => {
    if (clickSound.current) clickSound.current.muted = !isSoundAllowed;
    if (gameOverSound.current) gameOverSound.current.muted = !isSoundAllowed;
  }, [isSoundAllowed]);

  useEffect(() => {
    (async () => {
      const saved = await initYouTubeSDK({
        onAudioEnabledChanged: (enabled) => {
          setYtAudioEnabled(enabled);
        },
      });
      if (saved) {
        setScore(saved.score ?? 0);
        setTime(saved.time ?? 30);
        setBox(saved.box ?? { x: 50, y: 50 });
        setHighScore(saved.highScore ?? 0);
      }

      const initialAudioEnabled = isAudioEnabled();
      setSoundEnabled(initialAudioEnabled);
      setYtAudioEnabled(initialAudioEnabled);

      setTimeout(() => {
        setIsLoading(false);
        notifyGameReady();
      }, 1200);
    })();
  }, []);

  useGameLoop(() => {
    if (isGamePaused() || gameOver) return;
  });

  useEffect(() => {
    if (score > 0) sendScore(score);
  }, [score]);

  // ⏳ Timer
  useEffect(() => {
    if (time === 0) {
      setGameOver(true);

      // Play sound
      if (isSoundAllowed) gameOverSound.current?.play();

      // Save high score
      if (score > highScore) {
        setHighScore(score);
      }

      return;
    }

    const timer = setInterval(() => {
      if (!isGamePaused() && !isLoading && !gameOver) {
        setTime((t) => Math.max(t - 1, 0));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, gameOver, time]);

  useEffect(() => {
    saveGameData({ score, time, box, highScore });
  }, [score, time, box, highScore]);

  const moveBox = () => {
    if (gameOver) return;

    if (isSoundAllowed) clickSound.current?.play();

    setBox({
      x: Math.random() * 85,
      y: Math.random() * 75,
    });
    setScore((s) => s + 1);
  };

  const restartGame = () => {
    setScore(0);
    setTime(30);
    setGameOver(false);
    setBox({ x: 50, y: 50 });
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white flex flex-col items-center justify-center overflow-hidden">
      {/* HUD */}
      <div className="w-full max-w-md flex justify-between items-center px-4 py-2 text-lg font-semibold">
        <div className="flex gap-2">
          <div className="bg-gray-800/60 px-4 py-1 rounded-lg backdrop-blur">
            🎯 {score}
          </div>
          <div className="bg-gray-800/60 px-4 py-1 rounded-lg backdrop-blur">
            🏆 {highScore}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-gray-800/60 px-4 py-1 rounded-lg backdrop-blur">
            ⏳ {time}s
          </div>

          {/* 🔊 Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            disabled={!ytAudioEnabled}
            className="bg-gray-800/60 px-3 py-1 rounded-lg hover:bg-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur"
          >
            {ytAudioEnabled ? (soundEnabled ? "🔊" : "🔇") : "🔇"}
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative w-full max-w-md h-[70vh] border border-gray-700 rounded-2xl bg-gray-900/40 backdrop-blur overflow-hidden shadow-lg">
        {/* Click Box */}
        {!gameOver && (
          <div
            onClick={moveBox}
            className="absolute rounded-xl cursor-pointer transition-transform duration-150 active:scale-90"
            style={{
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: "clamp(40px, 8vw, 70px)",
              height: "clamp(40px, 8vw, 70px)",
              background: "linear-gradient(135deg, #ff4d4d, #ff0000)",
              boxShadow: "0 0 20px rgba(255,0,0,0.6)",
            }}
          />
        )}

        {/* 🛑 Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur">
            <h2 className="text-3xl font-bold mb-4">Game Over</h2>
            <p className="text-lg mb-2">Score: {score}</p>
            <p className="text-md mb-6 text-gray-400">
              High Score: {highScore}
            </p>

            <button
              onClick={restartGame}
              className="px-6 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Restart
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 text-sm text-gray-400">
        Tap the box as fast as you can 🚀
      </div>
    </div>
  );
}
