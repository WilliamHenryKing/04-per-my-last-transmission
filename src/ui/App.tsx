import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Controls } from "./Controls";
import type { Controller } from "./controller";
import { Ending } from "./Ending";
import { focusPlayControl } from "./focus";
import { Hint } from "./Hint";
import { commandForKey, keyTarget } from "./keyboard";
import { MissionCard } from "./MissionCard";
import { MissionList } from "./MissionList";
import { ResultCard } from "./ResultCard";
import { SoundButton } from "./SoundButton";
import { Title } from "./Title";

export interface AppProps {
  game: Controller;
  reducedMotion: boolean;
}

export function App({ game, reducedMotion }: AppProps) {
  useSyncExternalStore(game.subscribe, game.getVersion);
  const s = game.session;
  const hudRef = useRef<HTMLDivElement>(null);
  const focusFrame = useRef(0);
  const scheduleFocus = useCallback(() => {
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = 0;
      if (game.view === "play" && game.opening === "done") focusPlayControl();
    });
  }, [game]);
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);

  useLayoutEffect(() => {
    if (game.opening !== "done") return;
    const hud = hudRef.current;
    const mission = hud?.querySelector(".mission-card");
    if (!hud || !mission) return;
    const place = () =>
      hud.style.setProperty("--guide-top", `${mission.getBoundingClientRect().bottom + 12}px`);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(mission);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [game.opening]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = keyTarget(event.target);
      // Native buttons also repeat Enter. Prevent its default activation after launch.
      if (
        !event.defaultPrevented &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        target !== "text" &&
        target !== "scroll" &&
        event.repeat &&
        (event.key === " " || event.key === "Enter")
      ) {
        event.preventDefault();
        return;
      }
      const command = commandForKey(
        {
          key: event.key,
          target,
          repeat: event.repeat,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        game.opening,
        game.view,
      );
      if (!command) return;
      event.preventDefault();
      switch (command.type) {
        case "begin":
          game.begin(reducedMotion);
          break;
        case "mute":
          game.toggleMute();
          break;
        case "close":
          game.closePanel();
          break;
        case "aim":
          game.nudgeAim(command.angle, command.power);
          break;
        case "brake":
          game.brake();
          break;
        case "retry":
          game.retry();
          break;
        case "next":
          game.next();
          break;
        case "missions":
          game.openMissions();
          break;
        case "primary":
          if (game.session.phase !== "result") game.primary();
          else if (game.session.outcome?.verdict === "delivered") game.next();
          else game.retry();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, reducedMotion]);

  useEffect(() => {
    if (game.opening === "done" && s.phase === "aim") scheduleFocus();
  }, [game.opening, s.phase, scheduleFocus]);

  const dismissGuide = () => {
    game.dismissHint();
    scheduleFocus();
  };

  if (game.opening !== "done")
    return game.opening === "title" ? <Title onBegin={() => game.begin(reducedMotion)} /> : null;

  return (
    <>
      <div ref={hudRef} className="play-hud" inert={game.view !== "play"}>
        <header className="hud-header">
          <MissionCard game={game} />
          <div className="hud-tools">
            <div
              className="plate mission-clock px-3 py-1.5 font-mono text-sm tabular-nums"
              role="timer"
              aria-label="Mission clock"
            >
              <span className="label mr-2 text-[10px] opacity-70">Clock</span>T+
              {s.time.toFixed(1).padStart(4, "0")}s
            </div>
            <nav className="hud-buttons" aria-label="Mission tools">
              <button
                type="button"
                className="btn"
                aria-label="Replay the guide"
                disabled={s.phase === "result"}
                title={s.phase === "result" ? "Retry to replay the guide" : "Replay the guide"}
                onClick={() => game.replayGuide()}
              >
                ?
              </button>
              <SoundButton game={game} />
              <button
                type="button"
                className="btn px-3 py-2 text-xs"
                aria-keyshortcuts="L"
                onClick={() => game.openMissions()}
              >
                Missions<span className="kbd max-sm:hidden">L</span>
              </button>
            </nav>
          </div>
        </header>
        <div className="hud-status" role="status" aria-live="polite">
          {game.toast && (
            <p key={game.toast.id} className="toast plate label px-4 py-2 text-xs">
              {game.toast.text}
            </p>
          )}
          <p className="sr-only">
            {s.phase === "flight"
              ? s.flight?.braked
                ? "Brake applied."
                : "Parcel in flight. One brake available."
              : ""}
          </p>
        </div>
        <footer className="hud-footer">
          {s.phase === "result" ? (
            <ResultCard game={game} reducedMotion={reducedMotion} />
          ) : (
            <>
              {game.hintOpen && <Hint step={game.guideStep} onDismiss={dismissGuide} />}
              <Controls game={game} />
            </>
          )}
        </footer>
      </div>
      {game.view === "missions" && <MissionList game={game} onPlayFocus={scheduleFocus} />}
      {game.view === "ending" && (
        <Ending game={game} reducedMotion={reducedMotion} onPlayFocus={scheduleFocus} />
      )}
    </>
  );
}
