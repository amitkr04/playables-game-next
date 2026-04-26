"use client";
import { useState, useEffect } from "react";
import GamePage3D from "./GamePage3D";
import LoadingScreen from "./LoadingScreen";
import { Trophy, Volume2, VolumeX, Globe, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  initYouTubeSDK,
  notifyGameReady,
  updateGameSetting,
} from "./youtubeSdk";

const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिंदी" },
];

const GameWrapper = () => {
  const [loadingDone, setLoadingDone] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [bestScore, setBestScore] = useState(0);
  const [selectedLang, setSelectedLang] = useState("en");
  const [openLang, setOpenLang] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState(false);

  const t = useTranslations("spin_match");

  // Initialize YouTube SDK and load saved data from cloud
  useEffect(() => {
    const initSDK = async () => {
      console.log("[GameWrapper] Initializing YouTube SDK...");
      try {
        // Initialize SDK - this loads cloud save data and calls firstFrameReady
        const loadedData = await initYouTubeSDK({
          onAudioEnabledChanged: (enabled) => {
            setSoundOn(enabled);
          },
        });

        // Restore settings from cloud save or use defaults
        if (loadedData && typeof loadedData === "object") {
          console.log("[GameWrapper] Loaded settings from cloud:", loadedData);
          if (typeof loadedData.bestScore === "number") {
            setBestScore(loadedData.bestScore);
          }
          if (typeof loadedData.language === "string") {
            setSelectedLang(loadedData.language);
            if (typeof window !== "undefined") {
              window.appLanguage = loadedData.language;
            }
          }
          if (typeof loadedData.soundEnabled === "boolean") {
            setSoundOn(loadedData.soundEnabled);
          }
        }

        setSdkInitialized(true);
      } catch (error) {
        console.error("[GameWrapper] SDK initialization error:", error);
        setSdkInitialized(true); // Allow game to run in local mode
      }
    };

    initSDK();
  }, []);

  // Notify YouTube SDK that game is ready (must be after firstFrameReady)
  useEffect(() => {
    if (loadingDone && sdkInitialized) {
      notifyGameReady();
    }
  }, [loadingDone, sdkInitialized]);

  // Save sound settings to cloud
  useEffect(() => {
    if (sdkInitialized && soundOn !== true) {
      updateGameSetting("soundEnabled", soundOn);
    }
  }, [soundOn, sdkInitialized]);

  // Save language to cloud
  useEffect(() => {
    if (sdkInitialized && selectedLang !== "en") {
      updateGameSetting("language", selectedLang);
    }
  }, [selectedLang, sdkInitialized]);

  const toggleSound = () => {
    setSoundOn((prev) => !prev);
  };

  const changeLanguage = (lang) => {
    setSelectedLang(lang);
    if (typeof window !== "undefined") {
      window.appLanguage = lang;
      window.dispatchEvent(
        new CustomEvent("languageChanged", {
          detail: { lang },
        }),
      );
    }
    setOpenLang(false); // close dropdown after select
  };

  // Pass bestScore and setBestScore to GamePage3D via callback
  const handleLoadingComplete = () => {
    setLoadingDone(true);
  };

  if (!loadingDone) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Game */}
      <GamePage3D
        bestScore={bestScore}
        setBestScore={setBestScore}
        soundOn={soundOn}
      />

      {/* Top Right UI */}
      <div className="absolute top-4 right-4 flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg">
        {/* Best Score */}
        <div className="flex items-center gap-2 text-white font-semibold">
          <Trophy className="text-yellow-400" size={18} />
          <span>
            {t("best_score")} {bestScore}
          </span>
        </div>

        {/* Sound */}
        <button
          onClick={toggleSound}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
          title={soundOn ? t("sound_on") : t("sound_off")}
        >
          {soundOn ? (
            <Volume2 className="text-white" size={18} />
          ) : (
            <VolumeX className="text-white" size={18} />
          )}
        </button>

        {/* Language */}
        <div className="relative">
          <button
            onClick={() => setOpenLang((prev) => !prev)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
            title={t("slct_theme")}
          >
            <Globe className="text-white" size={18} />
          </button>

          {openLang && (
            <div className="absolute right-0 mt-2 bg-black text-white rounded-lg shadow-lg overflow-hidden min-w-[140px]">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className="flex items-center justify-between px-4 py-2 hover:bg-white/10 w-full text-left cursor-pointer"
                >
                  {lang.nativeLabel}
                  {selectedLang === lang.code && (
                    <Check size={16} className="text-green-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameWrapper;
