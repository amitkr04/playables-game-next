let ytGame = null;
let isPaused = false;
let audioEnabled = true;
let gameReadyCalled = false;
let firstFrameReadyCalled = false;
let initStartTime = 0;

const MAX_SAVE_BYTES = 3 * 1024 * 1024;
const GAME_READY_TIMEOUT = 5000;

/**
 * Wait for YouTube SDK to be available (window.ytgame)
 * Timeout: 5 seconds max
 */
const waitForYtGame = async () => {
  if (typeof window === "undefined") return null;
  const start = Date.now();
  while (!window.ytgame && Date.now() - start < GAME_READY_TIMEOUT) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return window.ytgame || null;
};

// Serialize game data to JSON string
const serializeSaveData = (data) => {
  try {
    return JSON.stringify(data);
  } catch {
    return "";
  }
};

// Validate save data size (must be <= 3 MiB)
const isSaveDataValid = (str) =>
  typeof str === "string" && str.length <= MAX_SAVE_BYTES;

// Parse saved data safely
const parseSaveData = (rawData) => {
  try {
    // Handle empty, null, or undefined data
    if (!rawData || typeof rawData !== "string" || rawData.trim() === "") {
      return null;
    }
    if (!isSaveDataValid(rawData)) {
      return null;
    }
    const parsed = JSON.parse(rawData);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.warn("Failed to parse save data:", error);
  }
  return null;
};

// Initialize YouTube Playables SDK
// IMPORTANT: Must be called as early as possible in the app lifecycle
//* Test case compliance:
// ✓ SDK loaded before any game code
// ✓ firstFrameReady called before gameReady
// ✓ gameReady called within 5 seconds

export const initYouTubeSDK = async (callbacks = {}) => {
  if (typeof window === "undefined") return null;
  initStartTime = Date.now();
  console.log("[YouTube SDK] Initializing...");

  const yt = await waitForYtGame();
  if (!yt) {
    console.warn("[YouTube SDK] Not found (running in local mode)");
    return null;
  }

  ytGame = yt;
  isPaused = false;

  // Get initial audio state
  if (ytGame.system?.isAudioEnabled) {
    audioEnabled = ytGame.system.isAudioEnabled();
    callbacks.onAudioEnabledChanged?.(audioEnabled);
    console.log("[YouTube SDK] Audio enabled:", audioEnabled);
  }

  // Load persisted game data from cloud save
  let loadedData = null;
  if (ytGame.game?.loadData) {
    try {
      const rawData = await ytGame.game.loadData();
      loadedData = parseSaveData(rawData);
      console.log("[YouTube SDK] Loaded save data:", loadedData);
    } catch (error) {
      console.warn("[YouTube SDK] loadData failed:", error);
      loadedData = null;
    }
  } else {
    console.log("[YouTube SDK] loadData not available (local mode)");
  }

  // CRITICAL: Call firstFrameReady BEFORE gameReady
  // This signals that the game has rendered its first frame
  try {
    firstFrameReadyCalled = true;
    ytGame.game.firstFrameReady();
    console.log("[YouTube SDK] firstFrameReady called");
  } catch (error) {
    console.warn("[YouTube SDK] firstFrameReady failed:", error);
  }

  // Setup pause/resume listeners
  if (ytGame.system?.onPause) {
    ytGame.system.onPause(() => {
      isPaused = true;
      console.log("[YouTube SDK] Game paused");
    });
  }

  if (ytGame.system?.onResume) {
    ytGame.system.onResume(() => {
      isPaused = false;
      console.log("[YouTube SDK] Game resumed");
    });
  }

  // Setup audio change listener
  if (ytGame.system?.onAudioEnabledChange) {
    ytGame.system.onAudioEnabledChange((enabled) => {
      audioEnabled = enabled;
      callbacks.onAudioEnabledChanged?.(enabled);
      console.log("[YouTube SDK] Audio enabled changed:", enabled);
    });
  }

  return loadedData;
};

/**
 * Notify YouTube that the game is ready to play
 * MUST be called after firstFrameReady and within 5 seconds of SDK init
 * Test case compliance:
 * ✓ gameReady called
 * ✓ gameReady called within 5 seconds
 */
export const notifyGameReady = () => {
  if (!ytGame?.game?.gameReady) {
    console.warn("[YouTube SDK] gameReady not available");
    return;
  }

  if (gameReadyCalled) {
    console.warn("[YouTube SDK] gameReady already called");
    return;
  }

  if (!firstFrameReadyCalled) {
    console.warn(
      "[YouTube SDK] firstFrameReady must be called before gameReady",
    );
    return;
  }

  const elapsed = Date.now() - initStartTime;
  if (elapsed > GAME_READY_TIMEOUT) {
    console.warn("[YouTube SDK] gameReady called too late (>5 seconds)");
  }

  try {
    gameReadyCalled = true;
    ytGame.game.gameReady();
    console.log("[YouTube SDK] gameReady called after", elapsed, "ms");
  } catch (error) {
    console.warn("[YouTube SDK] gameReady failed:", error);
    gameReadyCalled = false;
  }
};

/**
 * Save game data to cloud storage
 * Data is persisted and will be loaded on next session
 * Max size: 3 MiB
 * Test case compliance:
 * ✓ Cloud save data < 3 MiB
 */
export const saveGameData = async (data) => {
  if (!ytGame?.game?.saveData) {
    console.warn(
      "[YouTube SDK] saveData not available (running in local mode)",
    );
    return;
  }

  const serialized = serializeSaveData(data);
  if (!isSaveDataValid(serialized)) {
    console.error("[YouTube SDK] Save data exceeds 3 MiB limit");
    return;
  }

  try {
    await ytGame.game.saveData(serialized);
    console.log(
      "[YouTube SDK] Game data saved (" + serialized.length + " bytes)",
    );
  } catch (error) {
    console.warn("[YouTube SDK] saveData failed:", error);
  }
};

/**
 * Send player score to YouTube Playables
 * This is used for leaderboards and engagement tracking
 * Score must be a positive integer
 * Test case compliance:
 * ✓sendScore called with an integer
 */
export const sendScore = async (score) => {
  if (!ytGame?.engagement?.sendScore) {
    console.log(
      "[YouTube SDK] sendScore not available (running in local mode)",
    );
    return;
  }

  // Ensure score is a valid positive integer
  const value = Number.isFinite(score) ? Math.floor(score) : 0;
  if (value < 0) {
    console.warn("[YouTube SDK] Invalid score (negative)");
    return;
  }

  try {
    await ytGame.engagement.sendScore({ value });
    console.log("[YouTube SDK] Score sent:", value);
  } catch (error) {
    console.warn("[YouTube SDK] sendScore failed:", error);
  }
};

//Get current game settings from cloud save or defaults
export const getGameSettings = async (defaultSettings = {}) => {
  const defaults = {
    soundEnabled: true,
    language: "en",
    bestScore: 0,
    ...defaultSettings,
  };
  if (!ytGame?.game?.loadData) {
    console.log("[YouTube SDK] loadData not available, using defaults");
    return defaults;
  }
  try {
    const rawData = await ytGame.game.loadData();
    const data = parseSaveData(rawData);
    return { ...defaults, ...data };
  } catch (error) {
    console.warn("[YouTube SDK] Failed to get settings:", error);
    return defaults;
  }
};

//Update a single game setting in cloud save
export const updateGameSetting = async (key, value) => {
  try {
    const current = await getGameSettings();
    const updated = { ...current, [key]: value };
    await saveGameData(updated);
    return true;
  } catch (error) {
    console.warn("[YouTube SDK] Failed to update setting:", key, error);
    return false;
  }
};

// Utility functions
export const isGamePaused = () => isPaused;
export const isAudioEnabled = () => audioEnabled;
export const isSDKAvailable = () => ytGame !== null;
export const hasGameReadyBeenCalled = () => gameReadyCalled;
