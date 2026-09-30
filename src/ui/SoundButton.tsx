import type { Controller } from "./controller";

export function SoundButton({ game }: { game: Controller }) {
  return (
    <button
      type="button"
      className="btn sound-button px-3 py-2 text-xs"
      onClick={() => game.toggleMute()}
      aria-pressed={game.muted}
      aria-keyshortcuts="M"
      aria-label={game.muted ? "Sound off. Turn sound on (M)" : "Sound on. Mute (M)"}
    >
      {game.muted ? "Sound off" : "Sound on"}
      <span className="kbd max-sm:hidden">M</span>
    </button>
  );
}
