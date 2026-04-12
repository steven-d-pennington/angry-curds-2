import React from "react";

interface WinScreenProps {
  score: number;
  stars: number;
  hasNextLevel: boolean;
  onRetry: () => void;
  onNextLevel: () => void;
  onLevelSelect: () => void;
}

function starDisplay(stars: number): string {
  const filled = "\u2605"; // ★
  const empty = "\u2606";  // ☆
  return filled.repeat(stars) + empty.repeat(3 - stars);
}

export function WinScreen({
  score,
  stars,
  hasNextLevel,
  onRetry,
  onNextLevel,
  onLevelSelect,
}: WinScreenProps): React.JSX.Element {
  return (
    <div className="menu-screen result-screen" role="dialog" aria-label="Level Complete">
      <h2 style={{ color: "#44ff44" }}>Level Complete!</h2>
      <div className="stars" aria-label={`${stars} out of 3 stars`}>
        {starDisplay(stars)}
      </div>
      <p className="score-display">Score: {score.toLocaleString()}</p>
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
