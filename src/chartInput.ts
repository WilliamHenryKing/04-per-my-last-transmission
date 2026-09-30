/** One pointer owns chart aiming until release, cancellation or a closed game gate. */
export function bindChartInput(
  canvas: HTMLCanvasElement,
  allowed: () => boolean,
  aim: (event: PointerEvent) => void,
) {
  let pointer: number | null = null;
  const document = canvas.ownerDocument;
  const window = document.defaultView;
  const cancel = () => {
    const id = pointer;
    pointer = null;
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  };
  const sync = () => {
    if (!allowed() || document.hidden) cancel();
  };
  const down = (event: PointerEvent) => {
    if (
      pointer !== null ||
      event.button !== 0 ||
      event.isPrimary === false ||
      !allowed() ||
      document.hidden
    )
      return;
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    event.preventDefault();
    aim(event);
  };
  const move = (event: PointerEvent) => {
    sync();
    if (event.pointerId === pointer && canvas.hasPointerCapture(event.pointerId)) aim(event);
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId === pointer) cancel();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("lostpointercapture", end);
  window?.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", sync);
  return {
    sync,
    dispose() {
      cancel();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("lostpointercapture", end);
      window?.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", sync);
    },
  };
}
