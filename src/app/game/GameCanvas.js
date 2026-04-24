"use client";

import { useEffect, useState } from "react";
import useGameLoop from "./useGameLoop";
import {
  isGamePaused,
  initYouTubeSDK,
  saveGameData,
  sendScore,
} from "./youtubeSdk";

export default function GameCanvas() {
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [box, setBox] = useState({ x: 50, y: 50 });

  useEffect(() => {
    (async () => {
      const saved = await initYouTubeSDK();
      if (saved) {
        setScore(saved.score ?? 0);
        setTime(saved.time ?? 30);
        setBox(saved.box ?? { x: 50, y: 50 });
      }
    })();
  }, []);

  useGameLoop(() => {
    if (isGamePaused()) return;
  });

  useEffect(() => {
    if (score > 0) {
      sendScore(score);
    }
  }, [score]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isGamePaused()) {
        setTime((t) => Math.max(t - 1, 0));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    saveGameData({ score, time, box });
  }, [score, time, box]);

  const moveBox = () => {
    setBox({
      x: Math.random() * 80,
      y: Math.random() * 80,
    });
    setScore((s) => s + 1);
  };

  return (
    <div className="w-screen h-screen relative bg-black text-white">
      <div className="absolute top-2 left-2">Score: {score}</div>
      <div className="absolute top-2 right-2">Time: {time}</div>

      <div
        onClick={moveBox}
        style={{
          position: "absolute",
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: "60px",
          height: "60px",
          background: "red",
          cursor: "pointer",
        }}
      />
    </div>
  );
}
