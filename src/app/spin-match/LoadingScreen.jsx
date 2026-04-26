// LoadingScreen.jsx
"use client";
import { useState, useEffect } from "react";
import "./LoadingScreen.css";

import { useTranslations } from "next-intl";

export default function LoadingScreen({ onComplete }) {
  const t = useTranslations("spin_match.Spin-match-loading");
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  // Animate progress and call onComplete when done
  useEffect(() => {
    const duration = 700;
    const interval = 20;
    const steps = duration / interval;
    const progressPerStep = 100 / steps;

    let currentProgress = 0;
    const timer = setInterval(() => {
      currentProgress += progressPerStep;
      if (currentProgress >= 100) {
        setProgress(100);
        clearInterval(timer);
        setFadeOut(true);
        setTimeout(() => {
          onComplete?.();
        }, 300);
      } else {
        setProgress(Math.min(currentProgress, 99));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className={`loading-screen ${fadeOut ? "fade-out" : ""}`}>
      {/* Branding */}
      <div className="brand-box">
        {/* Logo image - gracefully handle missing file */}
        <div
          style={{
            width: 120,
            height: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "40px",
            fontWeight: "bold",
            color: "#00D4FF",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #00D4FF30, #FFD60030)",
            border: "2px solid #00D4FF",
          }}
          className="brand-logo"
        >
          🎮
        </div>
        <h1 className="brand-name">{t("CLOUDZFUN")}</h1>
      </div>

      {/* Game Name */}
      <div className="loading-header">
        <h2 className="loading-title">{t("SPINMATCH")}</h2>
        <p className="loading-subtitle">{t("Getready")}</p>
      </div>

      {/* Spinner */}
      <div className="loading-spinner"></div>

      {/* Progress Bar */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <p className="progress-text">{progress}%</p>
    </div>
  );
}
