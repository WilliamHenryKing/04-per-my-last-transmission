import { useEffect, useSyncExternalStore } from "react";
import { Controls } from "./Controls";
import type { Controller } from "./controller";
import { Ending } from "./Ending";
import { Hint } from "./Hint";
import { MissionCard } from "./MissionCard";
import { MissionList } from "./MissionList";
import { ResultCard } from "./ResultCard";
import { Title } from "./Title";

export interface AppProps {
  game: Controller;
  reducedMotion: boolean;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function App({ game, reducedMotion }: AppProps) {
  useSyncExternalStore(game.subscribe, game.getVersion);
  const s = game.session;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (game.opening !== "done") {
        if (e.key === "Enter" && !e.repeat) {
          e.preventDefault();
          game.begin(reducedMotion);
        }
        return;
      }
      if (e.key.toLowerCase() === "m" && !isTyping(e.target)) {
        game.toggleMute();
        e.preventDefault();
        return;
      }
      if (game.view !== "play") {
        if (e.key === "Escape" || e.key.toLowerCase() === "l") game.closePanel();
        return;
      }
      const onButton = e.target instanceof HTMLButtonElement;
      const onSlider = isTyping(e.target);
      const step = e.shiftKey ? 5 : 1;
      const key = e.key.toLowerCase();
      if (!onSlider && (key === "arrowleft" || key === "a")) game.nudgeAim(step, 0);
      else if (!onSlider && (key === "arrowright" || key === "d")) game.nudgeAim(-step, 0);
      else if (!onSlider && (key === "arrowup" || key === "w")) game.nudgeAim(0, step);
      else if (!onSlider && (key === "arrowdown" || key === "s")) game.nudgeAim(0, -step);
      else if ((key === " " || key === "enter") && !onButton) {
        const done = game.session.phase === "result";
        if (done && game.session.outcome?.verdict === "delivered") game.next();
        else if (done) game.retry();
        else game.primary();
      } else if (key === "b") game.brake();
      else if (key === "r") game.retry();
      else if (key === "n") game.next();
      else if (key === "l") game.openMissions();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, reducedMotion]);

  if (game.opening !== "done")
    return game.opening === "title" ? <Title onBegin={() => game.begin(reducedMotion)} /> : null;

  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col justify-between gap-3 p-3 sm:p-5">
      {/* Phones stack the title card above one compact row; wider screens sit them side by side. */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <MissionCard game={game} />
        <div className="pointer-events-auto flex items-center justify-end gap-2 sm:flex-col sm:items-end">
          <div
            className="plate mr-auto px-3 py-1.5 text-left font-mono text-sm tabular-nums sm:mr-0 sm:py-2 sm:text-right"
            role="timer"
            aria-label="Mission clock"
          >
            <span className="label mr-2 text-[10px] opacity-70 sm:mr-0 sm:block">Clock</span>T+
            {s.time.toFixed(1).padStart(4, "0")}s
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn"
              aria-label="Replay the guide"
              onClick={() => game.replayGuide()}
            >
              ?
            </button>
            <button
              type="button"
              className="btn min-h-11 px-3 py-2 text-xs sm:py-3"
              onClick={() => game.toggleMute()}
              aria-pressed={game.muted}
              aria-label={game.muted ? "Sound off. Turn sound on (M)" : "Sound on. Mute (M)"}
            >
              {game.muted ? "Sound off" : "Sound on"}
              <span className="kbd max-sm:hidden">M</span>
            </button>
            <button
              type="button"
              className="btn min-h-11 px-3 py-2 text-xs sm:px-4 sm:py-3"
              onClick={() => game.openMissions()}
            >
              Missions<span className="kbd max-sm:hidden">L</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center" aria-live="polite">
        {game.toast && (
          <p key={game.toast.id} className="toast plate label px-4 py-2 text-xs">
            {game.toast.text}
          </p>
        )}
      </div>

      <footer className="flex flex-col items-center gap-3">
        {s.phase === "result" && game.view === "play" && (
          <ResultCard game={game} reducedMotion={reducedMotion} />
        )}
        {game.hintOpen && game.view === "play" && (
          <Hint step={game.guideStep} onDismiss={() => game.dismissHint()} />
        )}
        <Controls game={game} />
      </footer>

      {game.view === "missions" && <MissionList game={game} />}
      {game.view === "ending" && <Ending game={game} reducedMotion={reducedMotion} />}
    </div>
  );
}
