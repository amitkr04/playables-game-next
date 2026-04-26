"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import InteractiveTutorial from "./InteractiveTutorial";
import { useTranslations } from "next-intl";
import Button from "./Button";
import { saveGameData, sendScore } from "./youtubeSdk";

// ─── Game Constants ───────────────────────────────────────────────────────────
const GAME_W = 390;
const GAME_H = 600;
const GROUND_Y_2D = GAME_H - 52;
const BALL_R_2D = 17;
const RING_R_2D = 80;
const RING_X_2D = GAME_W / 2;
const RING_Y_2D = 210;
const GRAVITY = 0.52;
const JUMP_VEL = -12.8;
const BASE_SPD = 0.028;
const MAX_SPD = 0.138;
const SEG_COLORS_HEX = ["#FF3B5C", "#00D4FF", "#FFD600", "#00FF88"];
const SEG_NAMES = ["RED", "BLUE", "YELLOW", "GREEN"];
const MILESTONES = [5, 10, 15, 20, 25, 30, 35, 40];

const SCALE = 0.025;
const toScene = (x2d, y2d) => ({
  x: (x2d - GAME_W / 2) * SCALE,
  y: -(y2d - GAME_H / 2) * SCALE,
});
const BALL_R = BALL_R_2D * SCALE;
const RING_R = RING_R_2D * SCALE;
const RING_POS = toScene(RING_X_2D, RING_Y_2D);
const GROUND_Y = toScene(0, GROUND_Y_2D).y;

// ─── Audio ────────────────────────────────────────────────────────────────────
let audioCtx = null;
let sounds = {};
let audioEnabled = true;

const initAudio = () => {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const mkJump = () => () => {
    if (!audioEnabled || !audioCtx) return;
    const n = audioCtx.currentTime,
      o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.frequency.value = 523.25;
    o.type = "sine";
    g.gain.value = 0.25;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.00001, n + 0.15);
    o.stop(n + 0.15);
  };
  const mkSuccess = () => () => {
    if (!audioEnabled || !audioCtx) return;
    const n = audioCtx.currentTime;
    [
      [659.25, 0, 0.2],
      [783.99, 0.1, 0.2],
      [1046.5, 0.2, 0.15],
    ].forEach(([f, d, g]) => {
      const o = audioCtx.createOscillator(),
        gn = audioCtx.createGain();
      o.connect(gn);
      gn.connect(audioCtx.destination);
      o.frequency.value = f;
      o.type = "sine";
      gn.gain.value = g;
      o.start(n + d);
      gn.gain.exponentialRampToValueAtTime(0.00001, n + 0.65);
      o.stop(n + 0.45);
    });
  };
  const mkMilestone = () => () => {
    if (!audioEnabled || !audioCtx) return;
    const n = audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.value = f;
      o.type = "sine";
      g.gain.value = 0.15;
      const st = n + i * 0.1;
      o.start(st);
      g.gain.exponentialRampToValueAtTime(0.00001, st + 0.5);
      o.stop(st + 0.3);
    });
  };

  const mkGameOver = () => () => {
    if (!audioEnabled) return;

    const audio = new Audio("/sounds/missing.mp3"); // from public folder
    audio.volume = 1.0; // adjust as needed
    audio.play().catch(() => {});
  };

  const mkFlip = () => () => {
    if (!audioEnabled || !audioCtx) return;
    const n = audioCtx.currentTime;
    for (let i = 0; i < 6; i++) {
      const o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.value = 400 + i * 80;
      o.type = "sine";
      g.gain.value = 0.12;
      const st = n + i * 0.06;
      o.start(st);
      g.gain.exponentialRampToValueAtTime(0.00001, st + 0.25);
      o.stop(st + 0.25);
    }
  };
  sounds = {
    jump: mkJump(),
    success: mkSuccess(),
    milestone: mkMilestone(),
    gameOver: mkGameOver(),
    flip: mkFlip(),
  };
};

const playSound = (name) => {
  if (!audioEnabled) return;
  if (!audioCtx) {
    initAudio();
    setTimeout(() => sounds[name]?.(), 50);
    return;
  }
  sounds[name]?.();
};

// ─── Segment helpers ───────────────────────────────────────────────────────────
const segmentAt = (worldAngle, ringAngle) => {
  let rel =
    (((worldAngle - ringAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(rel / (Math.PI / 2)) % 4;
};

const computeRingSpeed = (v) => Math.min(MAX_SPD, BASE_SPD + v * 0.0035);

// ─── Theme map ─────────────────────────────────────────────────────────────────
const GAME_THEMES = {
  deepspace: {
    bg: "#010208",
    ground: "#0a0f1c",
    glow: "#4478c8",
    fog: "#010208",
  },
};

export default function GamePage3D({
  headerControls,
  ytAudioEnabled = true,
  bestScore = 0,
  setBestScore,
  soundOn = true,
}) {
  const t = useTranslations("spin_match");
  const currentTheme = "deepspace";

  const [bestStreak, setBestStreak] = useState(bestScore);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [uiScore, setUiScore] = useState(0);
  const [uiDead, setUiDead] = useState(false);
  const [uiStreak, setUiStreak] = useState(0);
  const [uiBallColor, setUiBallColor] = useState(0);
  const [uiStarted, setUiStarted] = useState(false);
  const [uiMilestone, setUiMilestone] = useState(null);
  const [uiNewRecord, setUiNewRecord] = useState(false);

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);

  useEffect(() => {
    headerControls?.({
      bestStreak,
      isAudioOn,
      toggleAudio,
      resetGame,
    });
  }, [bestStreak, isAudioOn]);

  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const gameStateRef = useRef(null);
  const animIdRef = useRef(null);
  const bestStreakRef = useRef(0);

  useEffect(() => {
    bestStreakRef.current = bestStreak;
  }, [bestStreak]);

  // Sync best score from props (loaded from cloud save by GameWrapper)
  useEffect(() => {
    if (bestScore > 0) {
      setBestStreak(bestScore);
      bestStreakRef.current = bestScore;
    }
  }, [bestScore]);

  // Sync audio with YouTube SDK
  useEffect(() => {
    audioEnabled = ytAudioEnabled || soundOn;
  }, [ytAudioEnabled, soundOn]);

  // Save game data when bestStreak changes
  useEffect(() => {
    if (bestStreak > 0) {
      saveGameData({ bestStreak });
      sendScore(bestStreak);
    }
  }, [bestStreak]);

  // ── Build initial game state ────────────────────────────────────────────────
  const mkState = () => ({
    by: GROUND_Y_2D - BALL_R_2D,
    vy: 0,
    onGround: true,
    ballColorIdx: Math.floor(Math.random() * 4),
    ringAngle: 0,
    ringSpeed: BASE_SPD,
    ringDir: -1,
    inBand: false,
    passed: false,
    score: 0,
    streak: 0,
    started: false,
    dead: false,
    shake: 0,
    shakeTimer: 0,
    flashAlpha: 0,
    flashColor: null,
    milestoneText: null,
    milestoneTimer: 0,
    particles: [],
    hasNotifiedRecordThisRun: false,
  });

  // ── Three.js bootstrap ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth || 390;
    const H = mount.clientHeight || 600;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Scene & camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      GAME_THEMES[currentTheme]?.bg || "#010208",
    );

    // Orthographic-ish perspective to maintain 2D feel in 3D
    const aspect = W / H;
    const viewH = GAME_H * SCALE;
    const viewW = viewH * aspect;
    const camera = new THREE.OrthographicCamera(
      -viewW / 2,
      viewW / 2,
      viewH / 2,
      -viewH / 2,
      0.1,
      100,
    );
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    // Ambient + directional light
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(3, 8, 6);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Point lights for each segment color (for glow effect)
    const segLights = SEG_COLORS_HEX.map((hex, i) => {
      const pl = new THREE.PointLight(hex, 0, 3);
      pl.position.set(RING_POS.x, RING_POS.y, 0.5);
      scene.add(pl);
      return pl;
    });

    // ── Stars ────────────────────────────────────────────────────────────────
    const starCount = 200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * viewW;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * viewH;
      starPos[i * 3 + 2] = -1 + Math.random() * -3;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.04,
      transparent: true,
      opacity: 0.7,
    });
    const starMesh = new THREE.Points(starGeo, starMat);
    scene.add(starMesh);

    // ── Ground plane ─────────────────────────────────────────────────────────
    const groundGeo = new THREE.BoxGeometry(viewW, 0.15, 1.5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(GAME_THEMES[currentTheme]?.ground || "#0a0f1c"),
      roughness: 0.4,
      metalness: 0.6,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, GROUND_Y - 0.075, -0.5);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Ground line glow
    const glowGeo = new THREE.BoxGeometry(viewW, 0.025, 0.1);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.8,
    });
    const glowLine = new THREE.Mesh(glowGeo, glowMat);
    glowLine.position.set(0, GROUND_Y + 0.01, 0.1);
    scene.add(glowLine);

    // ── Ring (4 arc segments) ────────────────────────────────────────────────
    const SEGMENTS = 48;
    const ringGroup = new THREE.Group();
    ringGroup.position.set(RING_POS.x, RING_POS.y, 0);
    scene.add(ringGroup);

    const ringMeshes = SEG_COLORS_HEX.map((hex, i) => {
      const pts = [];
      const gapFrac = 0.035;
      const startA = (i * Math.PI) / 2 + gapFrac;
      const endA = ((i + 1) * Math.PI) / 2 - gapFrac;
      for (let s = 0; s <= SEGMENTS; s++) {
        const a = startA + (endA - startA) * (s / SEGMENTS);
        pts.push(
          new THREE.Vector3(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0),
        );
      }
      const geo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts),
        SEGMENTS,
        0.3,
        8,
        false,
      );
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        emissive: new THREE.Color(hex),
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.7,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      ringGroup.add(mesh);
      return mesh;
    });

    // ── Ball ──────────────────────────────────────────────────────────────────
    const ballGeo = new THREE.SphereGeometry(BALL_R, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(SEG_COLORS_HEX[0]),
      emissive: new THREE.Color(SEG_COLORS_HEX[0]),
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    ballMesh.position.set(RING_POS.x, GROUND_Y + BALL_R, 0);
    scene.add(ballMesh);

    // Ball highlight (specular dot)
    const hlGeo = new THREE.SphereGeometry(BALL_R * 0.3, 16, 16);
    const hlMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const hlMesh = new THREE.Mesh(hlGeo, hlMat);
    hlMesh.position.set(-BALL_R * 0.25, BALL_R * 0.25, BALL_R * 0.85);
    ballMesh.add(hlMesh);

    // Ball point light (for local glow)
    const ballLight = new THREE.PointLight(SEG_COLORS_HEX[0], 1.5, 1.5);
    ballMesh.add(ballLight);

    // ── Ball ──────────────────────────────────────────────────────────────────
    ballMesh.castShadow = true;
    ballMesh.position.set(RING_POS.x, GROUND_Y + BALL_R, 0);
    scene.add(ballMesh);

    const flameGroup = new THREE.Group();
    scene.add(flameGroup);

    // Outer flame cone
    const flameGeo = new THREE.ConeGeometry(BALL_R * 0.6, BALL_R * 1.8, 8);
    const flameMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(SEG_COLORS_HEX[0]),
      emissive: new THREE.Color(SEG_COLORS_HEX[0]),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.4,
    });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.castShadow = false;
    flameGroup.add(flameMesh);

    // Inner brighter flame
    const innerFlameGeo = new THREE.ConeGeometry(BALL_R * 0.3, BALL_R * 1.5, 6);
    const innerFlameMat = new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff6600,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.4,
    });
    const innerFlameMesh = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    flameGroup.add(innerFlameMesh);

    // Point light for flame glow
    const flameLight = new THREE.PointLight(SEG_COLORS_HEX[0], 0.8, 1.2);
    flameGroup.add(flameLight);

    // Store flame references
    const flameRefs = { flameGroup, flameMesh, innerFlameMesh, flameLight };

    // ── Particle pool ─────────────────────────────────────────────────────────
    const MAX_PARTICLES = 200;
    const particleGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(MAX_PARTICLES * 3);
    const pColors = new Float32Array(MAX_PARTICLES * 3);
    const pSizes = new Float32Array(MAX_PARTICLES);
    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(pPositions, 3),
    );
    particleGeo.setAttribute("color", new THREE.BufferAttribute(pColors, 3));
    particleGeo.setAttribute("size", new THREE.BufferAttribute(pSizes, 1));

    const particleMat = new THREE.PointsMaterial({
      size: 10,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthTest: false,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particleSystem.frustumCulled = false;
    scene.add(particleSystem);

    // ── Flash overlay (full screen quad) ─────────────────────────────────────
    const flashGeo = new THREE.PlaneGeometry(viewW, viewH);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff3b5c,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.set(0, 0, 5);
    scene.add(flashMesh);

    // ── Store all refs ────────────────────────────────────────────────────────

    threeRef.current = {
      renderer,
      scene,
      camera,
      starMesh,
      groundMesh,
      groundMat,
      glowLine,
      glowMat,
      ringGroup,
      ringMeshes,
      ballMesh,
      ballMat,
      ballLight,
      flameGroup: flameRefs.flameGroup,
      flameMesh: flameRefs.flameMesh,
      innerFlameMesh: flameRefs.innerFlameMesh,
      flameLight: flameRefs.flameLight,
      particleGeo,
      pPositions,
      pColors,
      pSizes,
      particleMat,
      particleSystem,
      flashMesh,
      flashMat,
      segLights,
      viewW,
      viewH,
      starMat,
    };

    // Resize handler
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      const asp = w / h;
      const vH = GAME_H * SCALE;
      const vW = vH * asp;
      camera.left = -vW / 2;
      camera.right = vW / 2;
      camera.top = vH / 2;
      camera.bottom = -vH / 2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // ── Spawn 3D particles ───────────────────────────────────────────────────────

  const spawnBurst = useCallback((colorIdx, isMilestone) => {
    const hex = SEG_COLORS_HEX[colorIdx];
    const cnt = isMilestone ? 46 : 26;
    const gs = gameStateRef.current;
    const ballY3d = toScene(RING_X_2D, gs.by).y;
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * Math.PI * 2;
      const s =
        (isMilestone ? 3.4 : 2.3) + Math.random() * (isMilestone ? 6.2 : 4.8);
      gs.particles.push({
        x: RING_POS.x,
        y: ballY3d,
        z: (Math.random() - 0.5) * 0.5,
        vx: Math.cos(a) * s * SCALE,
        vy: Math.sin(a) * s * SCALE - (isMilestone ? 0.05 : 0.03),
        vz: (Math.random() - 0.5) * 0.03,
        life: 1,
        color: hex,
        size: (isMilestone ? 3.2 : 2) + Math.random() * 5,
        fade: 0.022 + Math.random() * 0.02,
      });
    }
  }, []);

  // ── Game logic update (identical to 2D, translated to 3D positions) ──────────
  const updateGame = useCallback(
    (dt = 1) => {
      const gs = gameStateRef.current;
      if (!gs) return;

      // --- 1. Dead State Handling ---
      if (gs.dead) {
        if (gs.shakeTimer > 0) gs.shakeTimer -= 1;
        else gs.shake = 0;
        if (gs.flashAlpha > 0) gs.flashAlpha -= 0.03;
        if (gs.milestoneTimer > 0) gs.milestoneTimer -= 0.02;

        // Update existing particles during game over
        for (let i = gs.particles.length - 1; i >= 0; i--) {
          const p = gs.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= GRAVITY * SCALE * 0.4 * dt;
          p.life -= p.fade * dt;
          if (p.life <= 0) gs.particles.splice(i, 1);
        }
        return;
      }

      // --- 2. Physics logic (Ball) ---
      gs.vy += GRAVITY * dt;
      gs.by += gs.vy * dt;

      if (gs.by + BALL_R_2D >= GROUND_Y_2D) {
        gs.by = GROUND_Y_2D - BALL_R_2D;
        gs.vy = 0;
        gs.onGround = true;
        gs.passed = false;
        gs.inBand = false;
      } else {
        gs.onGround = false;
      }

      if (gs.by - BALL_R_2D <= 0) {
        gs.by = BALL_R_2D;
        if (gs.vy < 0) gs.vy = Math.abs(gs.vy) * 0.3;
      }

      // --- 3. Ring Rotation ---
      gs.ringAngle =
        (gs.ringAngle + gs.ringSpeed * gs.ringDir * dt + Math.PI * 2) %
        (Math.PI * 2);

      // --- 4. Effects Timers ---
      if (gs.shakeTimer > 0) {
        gs.shakeTimer -= 1;
        gs.shake = gs.shakeTimer;
      } else gs.shake = 0;

      if (gs.flashAlpha > 0) gs.flashAlpha -= 0.025 * dt;
      if (gs.milestoneTimer > 0) gs.milestoneTimer -= 0.022 * dt;

      // --- 5. Collision Detection ---
      const dy = gs.by - RING_Y_2D;
      const dist = Math.abs(dy);
      const inBand =
        dist >= RING_R_2D - BALL_R_2D && dist <= RING_R_2D + BALL_R_2D;

      if (inBand && !gs.inBand && !gs.passed && gs.started && !gs.dead) {
        const wAng = -Math.atan2(dy, 0);
        const hit = segmentAt(wAng, gs.ringAngle);

        // Exact hit position for burst
        const hitScene = toScene(RING_X_2D, gs.by);

        if (hit === gs.ballColorIdx) {
          // SUCCESS CASE
          gs.passed = true;
          gs.score++;
          gs.streak++;

          if (gs.streak > bestStreakRef.current) {
            // Update best score via props callback
            setBestScore?.(gs.streak);
            // Also save to cloud via SDK
            saveGameData({
              bestScore: gs.streak,
              soundEnabled: audioEnabled,
              language: "en",
            });
            setBestStreak(gs.streak);
            bestStreakRef.current = gs.streak;
            gs.hasNotifiedRecordThisRun = true;
          }

          playSound("success");
          gs.ringSpeed = computeRingSpeed(gs.score);
          gs.milestoneText = null;

          const isM = MILESTONES.includes(gs.score);
          if (isM) {
            const isFlip = gs.score % 10 === 0;
            gs.shakeTimer = 12;
            gs.milestoneText = isFlip ? t("dir_flip") : t("spd_up");
            gs.milestoneTimer = 1.2;
            if (isFlip) gs.ringDir *= -1;
            spawnBurst(gs.ballColorIdx, true, hitScene); // PASSING TO SCENE
          } else {
            spawnBurst(gs.ballColorIdx, false, hitScene);
          }

          // Randomize next color
          let ni;
          do {
            ni = Math.floor(Math.random() * 4);
          } while (ni === gs.ballColorIdx);
          gs.ballColorIdx = ni;

          // UI Updates
          setUiScore(gs.score);
          setUiStreak(gs.streak);
          setUiBallColor(gs.ballColorIdx);
          setUiMilestone(gs.milestoneText);
        } else {
          // DEATH CASE
          gs.dead = true;
          gs.shakeTimer = 22;
          gs.flashAlpha = 0.7;
          gs.flashColor = "#FF3B5C";
          playSound("gameOver");

          const ballPos3D = toScene(RING_X_2D, gs.by);

          for (let i = 0; i < 48; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = (2.5 + Math.random() * 7) * SCALE; // Scale the velocity!
            gs.particles.push({
              x: ballPos3D.x,
              y: ballPos3D.y,
              z: (Math.random() - 0.5) * 0.5,
              vx: Math.cos(a) * s,
              vy: Math.sin(a) * s,
              vz: (Math.random() - 0.5) * 0.04,
              life: 1,
              color: "#FF4466",
              size: 15, // Large size for visibility
              fade: 0.02 + Math.random() * 0.01,
            });
          }
          setUiDead(true);
          if (gs.hasNotifiedRecordThisRun) setUiNewRecord(true);
        }
      }
      gs.inBand = inBand;

      // --- 6. Active Particle Physics Update ---
      for (let i = gs.particles.length - 1; i >= 0; i--) {
        const p = gs.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= GRAVITY * SCALE * 0.5 * dt; // Gravity in 3D units
        p.life -= p.fade * dt;
        if (p.life <= 0) gs.particles.splice(i, 1);
      }
    },
    [spawnBurst, t],
  );

  // ── Render Three.js scene from game state ────────────────────────────────────

  const renderThree = useCallback(() => {
    const t = threeRef.current;
    const gs = gameStateRef.current;
    if (!t || !gs) return;

    // 1. Camera Shake logic
    t.camera.position.x =
      gs.shake > 0 ? (Math.random() - 0.5) * gs.shake * 0.012 : 0;
    t.camera.position.y =
      gs.shake > 0 ? (Math.random() - 0.5) * gs.shake * 0.01 : 0;

    // 2. Ball position & visual updates
    const bScene = toScene(RING_X_2D, gs.by);
    t.ballMesh.position.set(bScene.x, bScene.y, 0);

    const ballColor = new THREE.Color(SEG_COLORS_HEX[gs.ballColorIdx]);
    t.ballMat.color = ballColor;
    t.ballMat.emissive = ballColor;
    t.ballLight.color = ballColor;
    t.ballMesh.rotation.z += 0.04;

    // ========== ROCKET FLAME CONTROL (separate from ball rotation) ==========
    const isInAir = !gs.onGround && gs.started && !gs.dead;
    const isGoingUp = gs.vy > 0.5;
    const isGoingDown = gs.vy < 0.5;

    if (t.flameGroup && t.flameMesh && t.innerFlameMesh && t.flameLight) {
      // Update flame position to follow ball (at bottom OR top based on direction)
      if (isInAir) {
        let flameOffsetY;
        if (isGoingUp) {
          flameOffsetY = BALL_R * 0.9; // Bottom of ball
        } else if (isGoingDown) {
          flameOffsetY = -BALL_R * 0.9; // Top of ball (braking/falling flame)
        } else {
          flameOffsetY = -BALL_R * 0.7; // Default bottom
        }

        t.flameGroup.position.set(bScene.x, bScene.y + flameOffsetY, 0);

        // Update flame colors to match ball color
        const flameColor = ballColor;
        t.flameMesh.material.color = flameColor;
        t.flameMesh.material.emissive = flameColor;
        t.flameLight.color = flameColor;

        // Inner flame is brighter/yellowish
        t.innerFlameMesh.material.color.setHex(0xffaa66);
        t.innerFlameMesh.material.emissive.setHex(0xff4400);

        // Make flame visible
        t.flameGroup.visible = true;

        // Dynamic pulsation and scaling
        const pulse = 0.6 + Math.sin(Date.now() * 0.025) * 0.4;
        const velocityScale = Math.min(1 + Math.abs(gs.vy) * 0.2, 1.8);

        t.flameMesh.material.emissiveIntensity = 0.7 * pulse * velocityScale;
        t.innerFlameMesh.material.emissiveIntensity =
          1.0 * pulse * velocityScale;
        t.flameLight.intensity = 0.5 * pulse * velocityScale;

        // Scale flame based on velocity and direction
        const scaleX = velocityScale;
        const scaleY = velocityScale * (isGoingUp ? 1.2 : 0.9);
        t.flameMesh.scale.set(scaleX, scaleY, scaleX);
        t.innerFlameMesh.scale.set(scaleX, scaleY * 0.9, scaleX);

        // Rotate flame based on direction
        if (isGoingUp) {
          t.flameGroup.rotation.x = 0; // Pointing down
          t.flameGroup.rotation.z = 0;
        } else if (isGoingDown) {
          t.flameGroup.rotation.x = Math.PI; // Pointing up (retro rocket)
          t.flameGroup.rotation.z = 0;
        }
      } else {
        // Hide flame when on ground
        t.flameGroup.visible = false;
        // Reset scales
        t.flameMesh.scale.set(1, 1, 1);
        t.innerFlameMesh.scale.set(1, 1, 1);
      }
    }

    // 3. Ring rotation
    t.ringGroup.rotation.z = gs.ringAngle;

    // 4. Segment lights pulse
    t.segLights.forEach((pl, i) => {
      pl.intensity =
        i === gs.ballColorIdx ? 1.8 + Math.sin(Date.now() * 0.006) * 0.4 : 0;
    });

    // 5. Flash overlay management
    if (gs.flashAlpha > 0 && gs.flashColor) {
      t.flashMat.color.set(gs.flashColor);
      t.flashMat.opacity = gs.flashAlpha * 0.35;
    } else {
      t.flashMat.opacity = 0;
    }

    // 6. Particle System Update
    const totalPoolSize = 200;
    const activeParticles = gs.particles;
    const tempColor = new THREE.Color();

    for (let i = 0; i < totalPoolSize; i++) {
      const p = activeParticles[i];

      if (p && i < activeParticles.length) {
        t.pPositions[i * 3] = p.x;
        t.pPositions[i * 3 + 1] = p.y;
        t.pPositions[i * 3 + 2] = p.z;

        tempColor.set(p.color);
        t.pColors[i * 3] = tempColor.r;
        t.pColors[i * 3 + 1] = tempColor.g;
        t.pColors[i * 3 + 2] = tempColor.b;

        t.pSizes[i] = p.size * p.life * 5.0;
      } else {
        t.pPositions[i * 3] = 0;
        t.pPositions[i * 3 + 1] = -5000;
        t.pPositions[i * 3 + 2] = 0;
        t.pSizes[i] = 0;
      }
    }

    t.particleGeo.attributes.position.needsUpdate = true;
    t.particleGeo.attributes.color.needsUpdate = true;
    t.particleGeo.attributes.size.needsUpdate = true;

    // 7. Final Scene Render
    t.renderer.render(t.scene, t.camera);
  }, []);

  // ── Main game loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    gameStateRef.current = mkState();
    setUiDead(false);
    setUiScore(0);
    setUiStreak(0);
    setUiBallColor(gameStateRef.current.ballColorIdx);

    let lastTime = performance.now();

    const loop = (time) => {
      const dt = (time - lastTime) / 16.67; // normalize to 60 FPS
      lastTime = time;

      updateGame(dt); // 👈 pass dt
      renderThree();

      animIdRef.current = requestAnimationFrame(loop);
    };

    animIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [updateGame, renderThree]);

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    gameStateRef.current = mkState();
    setUiDead(false);
    setUiScore(0);
    setUiStreak(0);
    setUiBallColor(gameStateRef.current.ballColorIdx);
    setUiStarted(false);
    setUiMilestone(null);
    setUiNewRecord(false);
  }, []);

  // ── Jump ──────────────────────────────────────────────────────────────────────
  const performJump = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs || gs.dead) return;
    if (!audioCtx) initAudio();
    if (!gs.started) {
      gs.started = true;
      setUiStarted(true);
    }
    gs.vy = JUMP_VEL;
    gs.shake = Math.min(gs.shake + 2, 5);
    gs.shakeTimer = 7;
    playSound("jump");
    for (let i = 0; i < 6; i++) {
      const a = (Math.random() - 0.5) * Math.PI * 0.8;
      const s = 1.2 + Math.random() * 2;
      const ballY3d = toScene(RING_X_2D, gs.by).y;
      gs.particles.push({
        x: RING_POS.x,
        y: ballY3d,
        z: 0,
        vx: Math.cos(a) * s * SCALE,
        vy: Math.sin(a) * s * SCALE - 0.04,
        vz: (Math.random() - 0.5) * 0.02,
        life: 0.05,
        color: "#FFFFFF",
        size: 0.05 + Math.random() * 2,
        fade: 0.035,
      });
    }
  }, []);

  // ── Click / Touch / Key handlers ──────────────────────────────────────────────

  const handleClick = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs) return;

    if (showTutorial) return;

    if (gs.dead) {
      // resetGame();
      return;
    }
    performJump();
  }, [performJump, resetGame, showTutorial]);

  // ── Audio toggle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (showTutorial) return;
        handleClick();
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        resetGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClick, resetGame, showTutorial]);

  const toggleAudio = useCallback(() => {
    audioEnabled = !audioEnabled;
    setIsAudioOn(audioEnabled);
    if (audioEnabled && audioCtx?.state === "suspended") audioCtx.resume();
  }, []);

  // ── Initialize audio and sync with props ──────────────────────────────────────
  useEffect(() => {
    initAudio();
    audioEnabled = soundOn !== false;
    setIsAudioOn(audioEnabled);
  }, [soundOn]);

  // ── Milestone text auto-clear ─────────────────────────────────────────────────
  useEffect(() => {
    if (!uiMilestone) return;
    const t = setTimeout(() => setUiMilestone(null), 1500);
    return () => clearTimeout(t);
  }, [uiMilestone]);

  // Check if tutorial has been completed (using sessionStorage since it's device-specific)
  useEffect(() => {
    const completed =
      typeof window !== "undefined" &&
      typeof sessionStorage !== "undefined" &&
      sessionStorage?.getItem?.("tutorialCompleted3D");
    if (!completed) {
      setShowTutorial(true);
      resetGame();
    } else {
      setTutorialCompleted(true);
    }
  }, [resetGame]);

  const completeTutorial = () => {
    setShowTutorial(false);
    setTutorialCompleted(true);
    // Use sessionStorage for tutorial completion as it's device-specific
    if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
      try {
        sessionStorage?.setItem?.("tutorialCompleted3D", "true");
      } catch (error) {
        console.warn("Failed to set tutorial completion:", error);
      }
    }
    resetGame();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.outer}>
      {/* ── 3D Canvas container ── */}

      <div
        style={styles.canvasWrap}
        onClick={handleClick}
        onTouchStart={handleClick}
      >
        <div ref={mountRef} style={styles.mount} id="gameCanvas3D" />

        {showTutorial && (
          <>
            <canvas
              id="tutorialCanvas"
              width={GAME_W}
              height={GAME_H}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 25,
              }}
            />
            <InteractiveTutorial
              onComplete={completeTutorial}
              gameRef={gameStateRef}
              performJump={performJump}
              W={GAME_W}
              H={GAME_H}
              RING_X={RING_X_2D}
              RING_Y={RING_Y_2D}
              RING_R={RING_R_2D}
              BALL_R={BALL_R_2D}
              GROUND_Y={GROUND_Y_2D}
              SEG_COLORS_HEX={SEG_COLORS_HEX}
            />
          </>
        )}

        {/* Score overlay */}
        <div style={styles.scoreOverlay}>
          <span style={styles.scoreText}>{uiScore}</span>
        </div>

        {/* Streak badge */}

        {/* Ball color indicator */}
        <div
          style={{
            ...styles.colorIndicator,
            color: SEG_COLORS_HEX[uiBallColor],
          }}
        >
          {/* ● {SEG_NAMES[uiBallColor]} */}●{" "}
          {t(SEG_NAMES[uiBallColor].toLowerCase())}
        </div>

        {/* Milestone toast */}
        {uiMilestone && <div style={styles.milestonePop}>{uiMilestone}</div>}

        {/* Start hint */}
        {!uiStarted && !uiDead && (
          <div style={styles.hint}>{t("hint_text")}</div>
        )}

        {/* Game Over overlay */}
        {uiDead && !showTutorial && (
          <div style={styles.gameOverBg}>
            <div style={styles.gameOverCard}>
              <p style={styles.goTitle}>{t("game_end")}</p>
              <p style={styles.goScore}>{uiScore}</p>
              <p style={styles.goLabel}>{t("total_s")}</p>
              {uiNewRecord && (
                <p style={styles.goRecord}>
                  {t("best_record")} {bestStreak}
                </p>
              )}
              <div className="mt-5">
                <Button
                  shadowColor="#00f5d4"
                  className="py-2 sm:py-3 w-48 px-2 bg-[#00f5d4] text-[#00322d] font-bold text-xl rounded-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetGame();
                  }}
                >
                  {t("play_again")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline styles ──────────────────
const styles = {
  outer: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    minHeight: "100vh",
    maxWidth: 420,
    margin: "0 auto",
    gap: 10,
  },

  canvasWrap: {
    position: "relative",
    width: "100%",
    cursor: "pointer",
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid rgba(255,255,200,0.15)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
    aspectRatio: "390/600",
    userSelect: "none",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  mount: { width: "100%", height: "100%", display: "block" },
  scoreOverlay: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },
  scoreText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#f5f9ff",
    textShadow: "0 0 20px rgba(100,150,255,0.5)",
  },
  colorIndicator: {
    position: "absolute",
    top: 36,
    right: 10,
    fontSize: 11,
    fontWeight: "bold",
    pointerEvents: "none",
  },
  milestonePop: {
    position: "absolute",
    top: "28%",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFEAA0",
    textShadow: "0 0 12px rgba(255,200,50,0.8)",
    animation: "fadeInUp 0.3s ease",
    pointerEvents: "none",
    whiteSpace: "nowrap",
  },
  hint: {
    position: "absolute",
    bottom: "18%",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 11,
    fontWeight: "bold",
    color: "rgba(210,230,255,0.8)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  },
  gameOverBg: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  gameOverCard: {
    background: "#161b22",
    borderRadius: 16,
    padding: "28px 32px",
    width: 300,
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
  },
  goTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: "bold",
    color: "#ff4d6d",
    textShadow: "0 0 15px #ff4d6d66",
    letterSpacing: 2,
  },
  goScore: {
    margin: "8px 0 0",
    fontSize: 88,
    fontWeight: 900,
    color: "#fff",
    lineHeight: 1,
  },
  goLabel: {
    margin: 0,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 2,
  },
  goRecord: {
    margin: "10px 0 0",
    fontSize: 13,
    color: "#ffd966",
    fontWeight: "bold",
  },
};
