const STEPS = [
  [
    "Address the parcel",
    "Drag on the chart, move the sliders or use the arrow keys. The cream dots predict the real route; change your aim to see it bend.",
  ],
  [
    "Mind the moving address",
    "The café keeps orbiting. Watch where the route meets its ring, then Launch (Space). You can retry as often as the postal service requires.",
  ],
  [
    "One small correction",
    "Press B or tap Brake once in flight. The brass dots preview the slower route. Braking too early can leave you short of the dock.",
  ],
  [
    "Signed for, gently",
    "Reach the dock below its speed limit. A miss leaves a red route to learn from. Retry with R; a delivery unlocks the next parcel.",
  ],
];

export function Hint({ step, onDismiss }: { step: number; onDismiss: () => void }) {
  return (
    <aside
      className="plate guide-card keyboard-scroll pointer-events-auto max-w-[560px] px-3 py-2 text-xs sm:text-sm"
      aria-label="How to deliver"
      aria-live="polite"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Short-screen guidance must support native keyboard scrolling.
      tabIndex={0}
    >
      <p>
        <strong className="label text-post">
          {STEPS[step]?.[0]} · {step + 1}/4{" "}
        </strong>
        <br />
        {STEPS[step]?.[1]}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span aria-hidden="true">{STEPS.map((_, i) => (i === step ? "● " : "○ "))}</span>
        <button type="button" className="underline min-h-11 px-2" onClick={onDismiss}>
          Skip the guide
        </button>
      </div>
    </aside>
  );
}
