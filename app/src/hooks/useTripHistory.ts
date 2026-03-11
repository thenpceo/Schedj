import { useCallback, useRef } from "react";
import { TripState, TripEditHistory, TripV3, ReturnedFarm } from "@/lib/types";

const MAX_HISTORY = 50;

/**
 * Creates the initial history state from a given present state.
 */
export function createInitialHistory(present: TripState): TripEditHistory {
  return { past: [], present, future: [] };
}

/**
 * Creates a TripState snapshot from current workspace data.
 */
export function createTripState(
  trips: TripV3[],
  needsLocationFarms: import("@/lib/types").Farm[],
  returnedFarms: ReturnedFarm[]
): TripState {
  return {
    trips: structuredClone(trips),
    needsLocationFarms: structuredClone(needsLocationFarms),
    returnedFarms: structuredClone(returnedFarms),
    timestamp: Date.now(),
  };
}

/**
 * Push a new state onto the history stack.
 * Clears the redo (future) stack since we branched.
 */
export function pushHistory(
  history: TripEditHistory,
  newState: TripState
): TripEditHistory {
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return {
    past,
    present: newState,
    future: [], // new branch — clear redo
  };
}

/**
 * Undo: pop from past, push present to future.
 */
export function undoHistory(history: TripEditHistory): TripEditHistory | null {
  if (history.past.length === 0) return null;
  const past = [...history.past];
  const previous = past.pop()!;
  return {
    past,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/**
 * Redo: pop from future, push present to past.
 */
export function redoHistory(history: TripEditHistory): TripEditHistory | null {
  if (history.future.length === 0) return null;
  const future = [...history.future];
  const next = future.shift()!;
  return {
    past: [...history.past, history.present],
    present: next,
    future,
  };
}

/**
 * Hook that provides undo/redo keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z).
 * Returns a cleanup ref to attach to the component lifecycle.
 */
export function useUndoRedoKeys(
  onUndo: () => void,
  onRedo: () => void
) {
  const handlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  const attach = useCallback(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.key.toLowerCase() !== "z") return;

      // Don't intercept when user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      if (e.shiftKey) {
        onRedo();
      } else {
        onUndo();
      }
    };

    handlerRef.current = handler;
    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [onUndo, onRedo]);

  return attach;
}
