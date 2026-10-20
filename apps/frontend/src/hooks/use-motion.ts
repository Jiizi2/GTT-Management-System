import { useEffect, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getReducedMotionSnapshot(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}

function subscribeToReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => true);
}

export function useMotionPresence(isOpen: boolean, exitDurationMs = 240) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isPresent, setIsPresent] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsPresent(true);
      return undefined;
    }

    if (!isPresent) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => setIsPresent(false),
      prefersReducedMotion ? 0 : exitDurationMs,
    );
    return () => window.clearTimeout(timeoutId);
  }, [exitDurationMs, isOpen, isPresent, prefersReducedMotion]);

  return {
    isPresent,
    motionState: isOpen ? "open" : "closed",
  } as const;
}
