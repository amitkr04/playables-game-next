let ytGame = null;
let isPaused = false;
let isMuted = false;

const MAX_SAVE_BYTES = 3 * 1024 * 1024;

const waitForYtGame = async () => {
  if (typeof window === "undefined") return null;
  const start = Date.now();
  while (!window.ytgame && Date.now() - start < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return window.ytgame || null;
};

const serializeSaveData = (data) => {
  try {
    return JSON.stringify(data);
  } catch {
    return "";
  }
};

const isSaveDataValid = (str) => typeof str === "string" && str.length <= MAX_SAVE_BYTES;

export const initYouTubeSDK = async () => {
  if (typeof window === "undefined") return null;

  const yt = await waitForYtGame();
  if (!yt) {
    console.warn("ytgame not found (local mode)");
    return null;
  }

  ytGame = yt;
  isPaused = false;
  isMuted = false;

  let loadedData = null;
  if (ytGame.game?.loadData) {
    try {
      const rawData = await ytGame.game.loadData();
      if (typeof rawData === "string" && isSaveDataValid(rawData)) {
        loadedData = JSON.parse(rawData);
      }
    } catch (error) {
      console.warn("ytgame.game.loadData failed", error);
    }
  }

  try {
    ytGame.game.firstFrameReady();
    ytGame.game.gameReady();
  } catch (error) {
    console.warn("ytgame.game API not available yet", error);
  }

  if (ytGame.system?.onPause) {
    ytGame.system.onPause(() => {
      isPaused = true;
    });
  }

  if (ytGame.system?.onResume) {
    ytGame.system.onResume(() => {
      isPaused = false;
    });
  }

  if (ytGame.system?.onAudioEnabledChange) {
    ytGame.system.onAudioEnabledChange((enabled) => {
      isMuted = !enabled;
    });
  }

  return loadedData;
};

export const saveGameData = async (data) => {
  if (!ytGame?.game?.saveData) return;
  const serialized = serializeSaveData(data);
  if (!isSaveDataValid(serialized)) {
    console.warn("saveData exceeds 3 MiB limit");
    return;
  }

  try {
    await ytGame.game.saveData(serialized);
  } catch (error) {
    console.warn("ytgame.game.saveData failed", error);
  }
};

export const isGamePaused = () => isPaused;
export const isGameMuted = () => isMuted;

export const sendScore = async (score) => {
  if (!ytGame?.engagement?.sendScore) return;
  const value = Number.isFinite(score) ? Math.floor(score) : 0;
  if (value < 0) return;

  try {
    await ytGame.engagement.sendScore({ value });
  } catch (error) {
    // Ignore send failures in local or test environments.
  }
};

