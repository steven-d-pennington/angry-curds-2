import React, { useCallback, useEffect, useReducer } from "react";
import { TitleScreen } from "./screens/TitleScreen.js";
import { LevelSelectScreen, type LevelInfo } from "./screens/LevelSelectScreen.js";
import { WinScreen } from "./screens/WinScreen.js";
import { LoseScreen } from "./screens/LoseScreen.js";
import "./menu.css";

/* ── Public callbacks the game engine provides ───────────────── */

export interface MenuCallbacks {
  /** Start a level by 0-based index */
  startLevel: (levelIndex: number) => void;
  /** Retry the current level */
  retryLevel: () => void;
  /** Get level info for the select screen */
  getLevels: () => LevelInfo[];
  /** Whether there's a next level after the current one */
  hasNextLevel: () => boolean;
  /** Advance to the next level and start it */
  startNextLevel: () => void;
}

/* ── State machine ───────────────────────────────────────────── */

export type MenuScreen = "title" | "levelSelect" | "playing" | "win" | "lose";

interface MenuState {
  screen: MenuScreen;
  score: number;
  stars: number;
}

type MenuAction =
  | { type: "SHOW_LEVEL_SELECT" }
  | { type: "SHOW_TITLE" }
  | { type: "START_PLAYING" }
  | { type: "WIN"; score: number; stars: number }
  | { type: "LOSE"; score: number };

function menuReducer(_state: MenuState, action: MenuAction): MenuState {
  switch (action.type) {
    case "SHOW_TITLE":
      return { screen: "title", score: 0, stars: 0 };
    case "SHOW_LEVEL_SELECT":
      return { screen: "levelSelect", score: 0, stars: 0 };
    case "START_PLAYING":
      return { screen: "playing", score: 0, stars: 0 };
    case "WIN":
      return { screen: "win", score: action.score, stars: action.stars };
    case "LOSE":
      return { screen: "lose", score: action.score, stars: 0 };
  }
}

/* ── Component ───────────────────────────────────────────────── */

export interface MenuOverlayHandle {
  showWin: (score: number, stars: number) => void;
  showLose: (score: number) => void;
}

interface MenuOverlayProps {
  callbacks: MenuCallbacks;
  onHandle: (handle: MenuOverlayHandle) => void;
}

export function MenuOverlay({ callbacks, onHandle }: MenuOverlayProps): React.JSX.Element | null {
  const [state, dispatch] = useReducer(menuReducer, {
    screen: "title",
    score: 0,
    stars: 0,
  });

  // Expose imperative handle so game engine can trigger win/lose
  useEffect(() => {
    onHandle({
      showWin: (score, stars) => dispatch({ type: "WIN", score, stars }),
      showLose: (score) => dispatch({ type: "LOSE", score }),
    });
  }, [onHandle]);

  const handlePlay = useCallback(() => {
    dispatch({ type: "SHOW_LEVEL_SELECT" });
  }, []);

  const handleSelectLevel = useCallback(
    (levelIndex: number) => {
      dispatch({ type: "START_PLAYING" });
      callbacks.startLevel(levelIndex);
    },
    [callbacks],
  );

  const handleRetry = useCallback(() => {
    dispatch({ type: "START_PLAYING" });
    callbacks.retryLevel();
  }, [callbacks]);

  const handleNextLevel = useCallback(() => {
    dispatch({ type: "START_PLAYING" });
    callbacks.startNextLevel();
  }, [callbacks]);

  const handleBackToTitle = useCallback(() => {
    dispatch({ type: "SHOW_TITLE" });
  }, []);

  const handleBackToLevels = useCallback(() => {
    dispatch({ type: "SHOW_LEVEL_SELECT" });
  }, []);

  // During gameplay, overlay is hidden
  if (state.screen === "playing") {
    return null;
  }

  return (
    <div className="active" style={{ position: "fixed", inset: 0, zIndex: 100 }}>
      {state.screen === "title" && (
        <TitleScreen onPlay={handlePlay} />
      )}
      {state.screen === "levelSelect" && (
        <LevelSelectScreen
          levels={callbacks.getLevels()}
          onSelectLevel={handleSelectLevel}
          onBack={handleBackToTitle}
        />
      )}
      {state.screen === "win" && (
        <WinScreen
          score={state.score}
          stars={state.stars}
          hasNextLevel={callbacks.hasNextLevel()}
          onRetry={handleRetry}
          onNextLevel={handleNextLevel}
          onLevelSelect={handleBackToLevels}
        />
      )}
      {state.screen === "lose" && (
        <LoseScreen
          score={state.score}
          onRetry={handleRetry}
          onLevelSelect={handleBackToLevels}
        />
      )}
    </div>
  );
}
