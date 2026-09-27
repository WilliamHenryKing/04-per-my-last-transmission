import { useEffect, useRef } from "react";

/** Move keyboard focus to a panel's main action when it opens. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
