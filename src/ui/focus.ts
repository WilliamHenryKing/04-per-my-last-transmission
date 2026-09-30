import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";

const FOCUSABLE =
  "button:not(:disabled),input:not(:disabled),a[href],select:not(:disabled),textarea:not(:disabled),[tabindex='0']";

export function focusPlayControl(): void {
  const target = document.querySelector<HTMLElement>(
    ".launch-controls input:not(:disabled),.launch-controls button:not(:disabled),[data-result-primary]",
  );
  if (!target || target.closest("[inert]")) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Capture the actual opener; closing a modal returns keyboard focus to that control. */
export function usePanelFocus(modal: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  // Capture during the opening render, before the background's inert attribute commits.
  const opener = useRef(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    if (ref.current) ref.current.scrollTop = 0;
    return () => {
      if (!modal) return;
      const target = opener.current;
      if (target?.isConnected && !target.closest("[inert]")) target.focus({ preventScroll: true });
      else focusPlayControl();
    };
  }, [modal]);
  return ref;
}

export function cycleDialogFocus(
  event: { key: string; shiftKey: boolean; target: EventTarget | null; preventDefault(): void },
  actions: readonly HTMLElement[],
): void {
  if (event.key !== "Tab" || !actions.length) return;
  event.preventDefault();
  const current = actions.indexOf(event.target as HTMLElement);
  const next =
    current < 0
      ? event.shiftKey
        ? actions.length - 1
        : 0
      : (current + (event.shiftKey ? -1 : 1) + actions.length) % actions.length;
  actions[next]?.focus();
}

export function trapPanelTab(event: ReactKeyboardEvent, panel: HTMLElement | null): void {
  if (!panel) return;
  cycleDialogFocus(
    event,
    [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (node) => !node.closest("[inert],[hidden]"),
    ),
  );
}
