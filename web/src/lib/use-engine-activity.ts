'use client';

/**
 * Engine activity — the global "Flux is thinking" signal.
 *
 * A tiny module-level pub/sub store that any client component can push into:
 *   - the pipeline SSE stream (generation in flight)
 *   - insight refresh
 *   - the command palette's AI calls
 *   - brand DNA extraction, restyle, etc.
 *
 * Consumed by:
 *   - EnginePulse (the ambient rail orb: breathe at idle, ripple when thinking)
 *   - PulseLog (the Home heartbeat ticker — reads the recent log)
 *   - any element that wants a pulse-think glow while work is happening
 *
 * Deliberately framework-light: a Set of listeners + useSyncExternalStore.
 * No context provider needed — works anywhere under the app.
 */
import { useSyncExternalStore } from 'react';

export interface ActivityEntry {
  /** Monotonic id so React keys + dedupe are stable without Date.now(). */
  id: number;
  /** Human-readable, present-tense: "Analyzing your last 5 carousels". */
  label: string;
  /** When it started (epoch ms). */
  startedAt: number;
  /** When it ended (epoch ms), or null while in flight. */
  endedAt: number | null;
}

interface ActivityState {
  /** Number of in-flight tasks. isThinking = activeCount > 0. */
  activeCount: number;
  /** The label of the most-recent in-flight task (for tooltips). */
  currentLabel: string | null;
  /** Recent activity, newest first, capped. Drives the Pulse Log. */
  log: ActivityEntry[];
}

const LOG_CAP = 40;
let counter = 1;

let state: ActivityState = {
  activeCount: 0,
  currentLabel: null,
  log: [],
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ActivityState {
  return state;
}

// Server snapshot — stable empty state (avoids hydration mismatch).
const SERVER_STATE: ActivityState = { activeCount: 0, currentLabel: null, log: [] };
function getServerSnapshot(): ActivityState {
  return SERVER_STATE;
}

/**
 * Begin a tracked task. Returns an `end()` you MUST call (in a finally) to
 * mark completion. Safe to call from anywhere on the client.
 *
 *   const done = beginEngineTask('Generating your carousel');
 *   try { ...await work... } finally { done(); }
 */
export function beginEngineTask(label: string): () => void {
  const entry: ActivityEntry = {
    id: counter++,
    label,
    // Date.now is fine in the browser — this module is client-only.
    startedAt: Date.now(),
    endedAt: null,
  };
  state = {
    activeCount: state.activeCount + 1,
    currentLabel: label,
    log: [entry, ...state.log].slice(0, LOG_CAP),
  };
  emit();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const nextLog = state.log.map((e) =>
      e.id === entry.id ? { ...e, endedAt: Date.now() } : e,
    );
    const activeCount = Math.max(0, state.activeCount - 1);
    // currentLabel becomes the next still-active task, else null
    const stillActive = nextLog.find((e) => e.endedAt === null);
    state = {
      activeCount,
      currentLabel: stillActive ? stillActive.label : null,
      log: nextLog,
    };
    emit();
  };
}

/**
 * Record a completed, instantaneous activity (no duration) — e.g. "Found 3
 * trends", "Refreshed insights". Shows up in the Pulse Log immediately.
 */
export function reportEngineActivity(label: string): void {
  const now = Date.now();
  const entry: ActivityEntry = { id: counter++, label, startedAt: now, endedAt: now };
  state = {
    ...state,
    log: [entry, ...state.log].slice(0, LOG_CAP),
  };
  emit();
}

export interface EngineActivity {
  isThinking: boolean;
  currentLabel: string | null;
  log: ActivityEntry[];
}

/** Subscribe to engine activity in a component. */
export function useEngineActivity(): EngineActivity {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    isThinking: snap.activeCount > 0,
    currentLabel: snap.currentLabel,
    log: snap.log,
  };
}
