import React from "react";

interface TitleScreenProps {
  onPlay: () => void;
}

export function TitleScreen({ onPlay }: TitleScreenProps): React.JSX.Element {
  return (
    <div className="menu-screen title-screen" role="dialog" aria-label="Title Screen">
      <h1>Angry Curds 2</h1>
      <p className="subtitle">Revenge of the Fromage</p>
      <button
        className="menu-btn btn-primary"
        onClick={onPlay}
        autoFocus
      >
        Play
      </button>
    </div>
  );
}
