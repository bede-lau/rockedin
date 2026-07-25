import {
  PersistedStateSchema,
  type RockedInState,
} from "@/lib/schemas";
import { createSeedState } from "@/lib/seed";

export const STORAGE_KEY = "rockedin-demo-state-v1";

export function loadPersistedState(): RockedInState {
  if (typeof window === "undefined") {
    return createSeedState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createSeedState();
  }

  try {
    const parsed = PersistedStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.localStorage.removeItem(STORAGE_KEY);
      return createSeedState();
    }
    return parsed.data.state;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return createSeedState();
  }
}

export function savePersistedState(state: RockedInState) {
  if (typeof window === "undefined") {
    return;
  }

  const stateWithoutImages: RockedInState = {
    ...state,
    posts: state.posts.map((post) => {
      const copy = { ...post };
      delete copy.imageDataUrl;
      return copy;
    }),
    lastAgentReceipt: state.lastAgentReceipt
      ? { ...state.lastAgentReceipt, live: false }
      : undefined,
  };

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, state: stateWithoutImages }),
  );
}

export function clearPersistedState() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
