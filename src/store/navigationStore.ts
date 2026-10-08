/**
 * Navigation UI state.
 *
 * Zustand holds only what the interface needs to remember between renders:
 * the chosen origin and destination, the building whose details are open, and the
 * calculated route. The graph itself is deliberately *not* stored here - it is
 * derived from Firestore in CampusDataContext and read at calculation time, which
 * keeps a single source of truth for campus topology.
 */

import { create } from 'zustand';

import type { PathResult } from '@/types/campus';

export type RouteStatus = 'idle' | 'ready' | 'unreachable' | 'error';

interface NavigationState {
  originId: string | null;
  destinationId: string | null;
  /** Building whose information panel is open. */
  selectedId: string | null;
  /** Set when a search result asks the map to centre on a location. */
  focusId: string | null;
  /** Incremented on every focus request so repeat requests re-trigger the effect. */
  focusToken: number;
  result: PathResult | null;
  status: RouteStatus;
  /** Reason shown when status is 'error'. */
  message: string | null;

  setOrigin: (id: string | null) => void;
  setDestination: (id: string | null) => void;
  swapEndpoints: () => void;
  selectLocation: (id: string | null) => void;
  focusLocation: (id: string) => void;
  setResult: (result: PathResult, status: RouteStatus) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  originId: null,
  destinationId: null,
  selectedId: null,
  focusId: null,
  focusToken: 0,
  result: null,
  status: 'idle',
  message: null,

  setOrigin: (id) => set({ originId: id }),
  setDestination: (id) => set({ destinationId: id }),
  swapEndpoints: () => set({ originId: get().destinationId, destinationId: get().originId }),

  selectLocation: (id) => set({ selectedId: id }),

  focusLocation: (id) =>
    set((state) => ({ focusId: id, selectedId: id, focusToken: state.focusToken + 1 })),

  setResult: (result, status) => set({ result, status, message: null }),
  setError: (message) => set({ result: null, status: 'error', message }),

  reset: () =>
    set({
      originId: null,
      destinationId: null,
      result: null,
      status: 'idle',
      message: null,
    }),
}));