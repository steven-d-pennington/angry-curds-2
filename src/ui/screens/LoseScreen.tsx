import React, { useMemo } from "react";

interface LoseScreenProps {
  score: number;
  onContinue: () => void;
  onRetry: () => void;
  onLevelSelect: () => void;
}

const ENCOURAGE_MESSAGES = [
  "Almost had it! Give it another go?",
  "So close! Try a different angle!",
  "Don't let the rats win!",
  "Every cheese master was once a beginner!",
  "The curds believe in you!",
];

export function LoseScreen({
  score,
  onContinue,
  onRetry,
  onLevelSelect,
}: LoseScreenProps): React.JSX.Element {
  const message = useMemo(
    () => ENCOURAGE_MESSAGES[Math.floor(Math.random() * ENCOURAGE_MESSAGES.length)],
    [],
  );

  return (
    <div className="menu-screen result-screen lose-screen" role="dialog" aria-label="Level Failed">
      <h2>Not Quite!</h2>
      <p className="lose-message">{message}</p>
      <p className="score-display">Score: {score.toLocaleString()}</p>
      <div className="result-buttons">
        <button className="menu-btn btn-primary" onClick={onContinue} autoFocus>
          Continue (+3 Cheese)
        </button>
        <button className="menu-btn btn-danger" onClick={onRetry}>
          Try Again
        </button>
        <button className="menu-btn btn-secondary" onClick={onLevelSelect}>
          Levels
        </button>
      </div>
    </div>
  );
}
