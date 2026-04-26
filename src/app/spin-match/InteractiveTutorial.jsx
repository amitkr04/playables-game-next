"use client";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useRef } from "react";

const InteractiveTutorial = ({
  onComplete,
  gameRef,
  W,
  H,
  RING_X,
  RING_Y,
  RING_R,
  BALL_R,
  GROUND_Y,
  SEG_COLORS_HEX,
  performJump,
}) => {
  const t = useTranslations("spin_match");

  const [step, setStep] = useState(0);
  const [showArrow, setShowArrow] = useState(true);
  const [arrowPosition, setArrowPosition] = useState({ x: 0, y: 0 });
  const [pulseEffect, setPulseEffect] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const animationRef = useRef(null);
  const popupTimeoutRef = useRef(null);

  const colorNames = ["RED", "BLUE", "YELLOW", "GREEN"];

  const tutorialSteps = [
    {
      id: "jump",
      title: t("step_one_t"),
      message: t("step_one_msg"),
      instruction: t("step_one_ins"),
      target: "ball",
      action: "jump",
      msgPosition: "above",
    },
    {
      id: "color_match",
      title: t("step_two_t"),
      message: t("step_two_msg"),
      instruction: t("step_two_ins"),
      target: "ring_segment",
      action: "match",
      msgPosition: "below",
    },
    {
      id: "complete",
      title: t("step_three_t"),
      message: t("step_three_msg"),
      instruction: t("step_three_ins"),
      target: null,
      action: "complete",
      msgPosition: "center",
    },
  ];

  const currentStepData = tutorialSteps[step];

  const forceGreenBall = useCallback(() => {
    if (gameRef && gameRef.current) {
      gameRef.current.ballColorIdx = 3;
      if (window.updateUiBallColor) window.updateUiBallColor(3);
    }
  }, [gameRef]);

  const showSimplePopup = (message) => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => {
      setShowPopup(false);
    }, 2000);
  };

  const updateArrowPosition = useCallback(() => {
    if (!gameRef || !gameRef.current) return;

    if (currentStepData?.target === "ball") {
      const ballY = gameRef.current.by;
      const arrowX = RING_X;
      const arrowY = ballY - 40;
      setArrowPosition({ x: arrowX, y: arrowY });
    } else if (currentStepData?.target === "ring_segment") {
      const colorIdx = 4;
      const angle = -gameRef.current.ringAngle;
      const segmentAngle = angle + (colorIdx * Math.PI) / 2;

      const offsetX = Math.cos(segmentAngle + Math.PI / 4) * (RING_R + 25);
      const offsetY = Math.sin(segmentAngle + Math.PI / 4) * (RING_R + 25);

      setArrowPosition({ x: RING_X + offsetX, y: RING_Y + offsetY });
    }
  }, [currentStepData, gameRef, RING_X, RING_Y, RING_R]);

  const drawTutorialOverlay = useCallback(() => {
    const canvas = document.querySelector("#tutorialCanvas");
    if (!canvas || step >= tutorialSteps.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stepData = tutorialSteps[step];

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, W, H);

    if (showPopup) {
      const popupW = 280;
      const popupH = 50;
      const popupX = W / 2 - popupW / 2;
      const popupY = H / 2 - popupH / 2;

      ctx.fillStyle = "#FF3B5C";
      ctx.fillRect(popupX, popupY, popupW, popupH);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(popupX, popupY, popupW, popupH);
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(t("wrong_match"), W / 2, popupY + 32);
    }

    if (stepData.target === "ball" && gameRef && gameRef.current) {
      ctx.beginPath();
      ctx.arc(RING_X, gameRef.current.by, BALL_R + 15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 245, 212, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "#00f5d4";
      ctx.lineWidth = 3;
      ctx.stroke();

      if (pulseEffect) {
        ctx.beginPath();
        ctx.arc(RING_X, gameRef.current.by, BALL_R + 25, 0, Math.PI * 2);
        ctx.strokeStyle = "#00f5d4";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (
      stepData.target === "ring_segment" &&
      gameRef &&
      gameRef.current
    ) {
      const colorIdx = 4;
      const angle = -gameRef.current.ringAngle;
      const sa = angle + (colorIdx * Math.PI) / 2;
      const ea = sa + Math.PI / 2;

      ctx.beginPath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw message box
    ctx.font = "bold 16px 'Poppins', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.shadowBlur = 0;

    if (stepData.msgPosition === "above" && gameRef && gameRef.current) {
      const msgY = gameRef.current.by - 100;
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(W / 2 - 140, msgY - 20, 280, 40);
      ctx.fillStyle = "#00f5d4";
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillText(stepData.title, W / 2, msgY - 16);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillText(stepData.message, W / 2, msgY + 10);
    } else if (stepData.msgPosition === "below") {
      const msgY = RING_Y + RING_R + 70;
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(W / 2 - 160, msgY - 10, 320, 40);
      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillText(stepData.title, W / 2, msgY - 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px 'Poppins', sans-serif";
      ctx.fillText(stepData.message, W / 2, msgY + 5);
    } else if (stepData.msgPosition === "center") {
      const centerY = H / 2 - 50;
      ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
      ctx.fillRect(W / 2 - 160, centerY - 30, 320, 80);
      ctx.fillStyle = "#ffd966";
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillText(stepData.title, W / 2, centerY - 5);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillText(stepData.message, W / 2, centerY + 25);
      ctx.fillStyle = "#00f5d4";
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillText(stepData.instruction, W / 2, centerY + 50);
    }

    // Draw instruction text
    if (stepData.instruction && stepData.msgPosition !== "center") {
      ctx.font = "bold 16px 'Poppins', sans-serif";
      ctx.fillStyle = "#ffd966";
      ctx.fillText(stepData.instruction, W / 2, H - 5);
    }

    ctx.restore();
  }, [
    step,
    pulseEffect,
    showPopup,
    gameRef,
    W,
    H,
    RING_X,
    RING_Y,
    RING_R,
    BALL_R,
    SEG_COLORS_HEX,
  ]);

  const drawArrow = useCallback(() => {
    const canvas = document.querySelector("#tutorialCanvas");
    if (!canvas || !showArrow) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = arrowPosition;
    if (!x || !y) return;

    ctx.save();
    ctx.shadowBlur = 0;

    // Draw dashed line
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(x, y - 30);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw arrow head
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 10);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 10, y - 10);
    ctx.fillStyle = "#00f5d4";
    ctx.fill();

    // Draw circle
    ctx.beginPath();
    ctx.arc(x, y - 30, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#00f5d4";
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x, y - 30, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bouncing animation
    const bounce = Math.sin(Date.now() * 0.01) * 5;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 30 + bounce);
    ctx.lineTo(x, y - 25 + bounce);
    ctx.lineTo(x + 5, y - 30 + bounce);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.restore();
  }, [arrowPosition, showArrow]);

  // Animation loop for tutorial overlay
  useEffect(() => {
    if (step < tutorialSteps.length) {
      const drawLoop = () => {
        drawTutorialOverlay();
        drawArrow();
        animationRef.current = requestAnimationFrame(drawLoop);
      };
      animationRef.current = requestAnimationFrame(drawLoop);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [step, drawTutorialOverlay, drawArrow, tutorialSteps.length]);

  // Update arrow position
  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (showArrow) {
        updateArrowPosition();
      }
    }, 100);
    return () => clearInterval(updateInterval);
  }, [showArrow, updateArrowPosition]);

  // Pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseEffect((prev) => !prev);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Handle jump in tutorial - THIS IS THE KEY FUNCTION
  const triggerTutorialJump = useCallback(() => {
    if (step === 0) {
      // Perform the jump
      if (performJump) {
        performJump();
      }
      // Advance to step 2 after jump
      setTimeout(() => {
        setStep(1);
        setShowArrow(true);
        forceGreenBall();
        if (gameRef && gameRef.current) {
          gameRef.current.score = 0;
          gameRef.current.streak = 0;
        }
      }, 100);
    } else if (step === 1) {
      // Just jump, don't advance
      if (performJump) {
        performJump();
      }
    } else if (step === 2) {
      // Complete tutorial
      if (onComplete) onComplete();
    }
  }, [step, performJump, forceGreenBall, gameRef, onComplete]);

  // Handle successful color match
  const handleScoreAdvance = useCallback(() => {
    if (step === 1) {
      setStep(2);
      setShowArrow(false);
    }
  }, [step]);

  // Reset step 2 on wrong color
  const resetStep2 = useCallback(() => {
    if (step === 1) {
      showSimplePopup("WRONG COLOR!");

      // Reset game state
      if (gameRef && gameRef.current) {
        gameRef.current.dead = false;
        gameRef.current.score = 0;
        gameRef.current.streak = 0;
        gameRef.current.by = GROUND_Y - BALL_R;
        gameRef.current.vy = 0;
        gameRef.current.started = false;
        gameRef.current.ballColorIdx = 3; // Force GREEN
        gameRef.current.ringAngle = 0;
        gameRef.current.ringSpeed = 0.028;
        gameRef.current.ringDir = -1;
        gameRef.current.inBand = false;
        gameRef.current.passed = false;
        gameRef.current.shake = 0;
        gameRef.current.particles = [];
      }
    }
  }, [step, gameRef, GROUND_Y, BALL_R]);

  // Monitor game state for progression
  useEffect(() => {
    let lastScore = 0;
    let lastDeadState = false;

    const checkProgress = setInterval(() => {
      if (gameRef && gameRef.current) {
        // Check for wrong color (death)
        if (step === 1 && gameRef.current.dead && !lastDeadState) {
          resetStep2();
        }

        // Check for successful match (score increase)
        if (step === 1 && gameRef.current.score > lastScore) {
          handleScoreAdvance();
        }

        lastScore = gameRef.current.score;
        lastDeadState = gameRef.current.dead;
      }
    }, 50);

    return () => clearInterval(checkProgress);
  }, [step, gameRef, handleScoreAdvance, resetStep2]);

  // Force GREEN ball color when entering step 1
  useEffect(() => {
    if (step === 1) {
      forceGreenBall();
    }
  }, [step, forceGreenBall]);

  // Add click listener to canvas for tutorial
  useEffect(() => {
    const canvas = document.querySelector("#gameCanvas3D");
    if (!canvas) return;

    const handleCanvasClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerTutorialJump();
    };

    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("touchstart", handleCanvasClick);

    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
      canvas.removeEventListener("touchstart", handleCanvasClick);
    };
  }, [triggerTutorialJump]);

  // Add keyboard listener for tutorial
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        triggerTutorialJump();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerTutorialJump]);

  // Cleanup popup timeout
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  return null;
};

export default InteractiveTutorial;
