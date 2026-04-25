import { useEffect, useRef } from "react";

export default function useGameLoop(callback) {
  const requestRef = useRef();

  useEffect(() => {
    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;
      callback();
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(requestRef.current);
    };
  }, [callback]);
}
