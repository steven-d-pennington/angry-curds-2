import React from "react";

interface LoseScreenProps {
  score: number;
  onRetry: () => void;
  onLevelSelect: () => void;
}

export function LoseScreen({
  score,
  onRetry,
  onLevelSelect,
}: LoseScreenProps): React.JSX.Element {
  return (
    <div className="menu-screen result-screen" role="dialog" aria-label="Level Failed">
      <h2 style={{ color: "#ff4444" }}>Try Again!</h2>
      <p className="score-display">Score: {score.toLocaleString()}</p>
      <div className="result-buttons">
        <button className="menu-btn btn-danger" onClick={onRetry} autoFocus>
          Try Again
        </button>
        <button className="menu-btn btn-secondary" onClick={onLevelSelect}>
          Levels
        </button>
      </div>
    </div>
  );
}
