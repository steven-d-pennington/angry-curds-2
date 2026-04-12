import React from "react";

export interface LevelInfo {
  /** 1-based level number */
  number: number;
  /** Whether this level is unlocked */
  unlocked: boolean;
  /** Best star rating (0 = not completed, 1-3 = stars earned) */
  bestStars: number;
}

interface LevelSelectScreenProps {
  levels: LevelInfo[];
  onSelectLevel: (levelIndex: number) => void;
  onBack: () => void;
}

function starDisplay(stars: number): string {
  const filled = "\u2605"; // ★
  const empty = "\u2606";  // ☆
  return filled.repeat(stars) + empty.repeat(3 - stars);
}

export function LevelSelectScreen({
  levels,
  onSelectLevel,
  onBack,
}: LevelSelectScreenProps): React.JSX.Element {
  return (
    <div className="menu-screen level-select" role="dialog" aria-label="Level Select">
      <h2>Select Level</h2>
      <div className="level-grid" role="list">
        {levels.map((level, index) => (
          <button
            key={level.number}
            className="level-card"
            role="listitem"
            disabled={!level.unlocked}
            onClick={() => onSelectLevel(index)}
            aria-label={`Level ${level.number}${level.unlocked ? `, ${level.bestStars} stars` : ", locked"}`}
            autoFocus={index === 0}
          >
            <span className="level-num">{level.number}</span>
            {level.unlocked && (
              <span className="level-stars" aria-hidden="true">
                {starDisplay(level.bestStars)}
              </span>
            )}
          </button>
        ))}
      </div>
      <button className="menu-btn btn-secondary" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
