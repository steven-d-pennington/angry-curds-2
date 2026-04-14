import React, { useEffect, useMemo, useRef, useState } from "react";

interface WinScreenProps {
  score: number;
  stars: number;
  hasNextLevel: boolean;
  onRetry: () => void;
  onNextLevel: () => void;
  onLevelSelect: () => void;
}

/** Generates confetti pieces with random positions, colors, and timing. */
function useConfetti(count: number) {
  return useMemo(() => {
    const colors = ["#ffcc00", "#ff9800", "#ff5722", "#4caf50", "#2196f3", "#e91e63", "#9c27b0"];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      delay: `${Math.random() * 1.5}s`,
      duration: `${2 + Math.random() * 2}s`,
      size: 5 + Math.random() * 6,
      rotation: Math.random() * 360,
    }));
  }, [count]);
}

/** Animates score from 0 to target value. */
function useCountUp(target: number, duration: number, delay: number): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now() + delay;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, delay]);

  return value;
}

const WIN_MESSAGES = [
  "Gouda job!",
  "That was grate!",
  "Un-brie-lievable!",
  "You curd do it!",
  "Wheely impressive!",
];

export function WinScreen({
  score,
  stars,
  hasNextLevel,
  onRetry,
  onNextLevel,
  onLevelSelect,
}: WinScreenProps): React.JSX.Element {
  const confetti = useConfetti(30);
  const displayScore = useCountUp(score, 1000, 1200);
  const message = useMemo(
    () => WIN_MESSAGES[Math.floor(Math.random() * WIN_MESSAGES.length)],
    [],
  );

  return (
    <div className="menu-screen result-screen win-screen" role="dialog" aria-label="Level Complete">
      {/* Confetti */}
      <div className="confetti-container" aria-hidden="true">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="confetti-piece"
            style={{
              left: c.left,
              top: "-10px",
              width: c.size,
              height: c.size,
              background: c.color,
              animationDelay: c.delay,
              animationDuration: c.duration,
              transform: `rotate(${c.rotation}deg)`,
            }}
          />
        ))}
      </div>

      <h2>Level Complete!</h2>
      <p className="win-message">{message}</p>

      {/* Stars with sequential pop animation */}
      <div className="result-stars" aria-label={`${stars} out of 3 stars`}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`result-star ${i <= stars ? "result-star--filled" : "result-star--empty"}`}
          >
            {i <= stars ? "\u2605" : "\u2606"}
          </span>
        ))}
      </div>

      <p className="score-display">
        Score: {displayScore.toLocaleString()}
      </p>

      <div className="result-buttons">
        <button className="menu-btn btn-secondary" onClick={onRetry} autoFocus>
          Retry
        </button>
        {hasNextLevel && (
          <button className="menu-btn btn-primary" onClick={onNextLevel}>
            Next Level
          </button>
        )}
        <button className="menu-btn btn-secondary" onClick={onLevelSelect}>
          Levels
        </button>
      </div>
    </div>
  );
}
