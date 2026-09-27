export function Hint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside
      className="plate pointer-events-auto flex max-w-[560px] items-start gap-3 px-3 py-2 text-xs sm:text-sm"
      aria-label="How to deliver"
    >
      <p>
        <strong className="label text-post">Induction, abridged. </strong>
        Drag on the chart (or use the sliders) to aim. The dotted line is the honest route. Watch
        the dock's orbit and <strong>launch</strong> when the route meets it. Mid-flight, you get{" "}
        <strong>one brake</strong>: the brass dots show where it would take you. Retry anytime.
      </p>
      <button type="button" className="btn shrink-0 px-3 py-2 text-xs" onClick={onDismiss}>
        Noted
      </button>
    </aside>
  );
}
