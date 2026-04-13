import React from "react";

interface LoseScreenProps {
  score: number;
  onContinue: () => void;
  onRetry: () => void;
  onLevelSelect: () => void;
}

export function LoseScreen({
  score,
  onContinue,
  onRetry,
  onLevelSelect,
}: LoseScreenProps): React.JSX.Element {
  return (
    <div className="menu-screen result-screen" role="dialog" aria-label="Level Failed">
      <h2 style={{ color: "#ff4444" }}>Try Again!</h2>
      <p className="score-display">Score: {score.toLocaleString()}</p>
      <div className="result-buttons">
        <button className="menu-btn btn-primary" onClick={onContinue} autoFocus>
          Continue (+3)
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
