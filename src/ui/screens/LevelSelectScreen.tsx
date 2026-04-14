import React from "react";

export interface LevelInfo {
  /** 1-based level number */
  number: number;
  /** Human-readable level name */
  name: string;
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

function StarIcon({ filled }: { filled: boolean }): React.JSX.Element {
  return (
    <span
      className={`level-star ${filled ? "level-star--filled" : "level-star--empty"}`}
      aria-hidden="true"
    >
      {filled ? "\u2605" : "\u2606"}
    </span>
  );
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
            aria-label={`Level ${level.number}: ${level.name}${level.unlocked ? `, ${level.bestStars} stars` : ", locked"}`}
            autoFocus={index === 0}
          >
            <span className="level-num">{level.number}</span>
            <span className="level-name">{level.name}</span>
            {level.unlocked ? (
              <span className="level-stars">
                <StarIcon filled={level.bestStars >= 1} />
                <StarIcon filled={level.bestStars >= 2} />
                <StarIcon filled={level.bestStars >= 3} />
              </span>
            ) : (
              <span className="level-lock" aria-hidden="true">
                &#x1F512;
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
