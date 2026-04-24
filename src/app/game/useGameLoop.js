import { useEffect, useRef } from "react";

export default function useGameLoop(callback) {
  const requestRef = useRef();

  const loop = () => {
    callback();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);
}
