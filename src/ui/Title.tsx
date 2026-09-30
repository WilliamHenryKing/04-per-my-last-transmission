import { useEffect, useRef } from "react";

export function Title({ onBegin }: { onBegin: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="opening" aria-labelledby="opening-title">
      <div className="opening-copy">
        <p className="rise label text-brass">Interplanetary post · Induction 001</p>
        <h1 className="rise" id="opening-title">
          Per my last
          <br />
          transmission.
        </h1>
        <p className="rise premise">
          One fragile mug. One moving moon café.
          <br />
          Customer service insists gravity is your problem.
        </p>
        <div className="rise">
          <button ref={button} type="button" className="btn btn-post" onClick={onBegin}>
            Report for duty
          </button>
          <span className="enter-note">or press Enter</span>
        </div>
      </div>
    </section>
  );
}
