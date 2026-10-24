import { useSyncExternalStore } from "react";

let lowCount = 0;
const listeners = new Set<() => void>();

export function setLowCount(value: number) {
  const next = Math.max(0, Math.round(value));
  if (next === lowCount) return;
  lowCount = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return lowCount;
}

function getServerSnapshot() {
  return 0;
}

export function useLowCount() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
