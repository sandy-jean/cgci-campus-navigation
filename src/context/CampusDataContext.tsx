/**
 * Campus data context.
 *
 * Owns the single live copy of locations, edges, and the derived graph. Firestore
 * listeners push updates in; `buildGraph` turns them into the adjacency list that
 * Dijkstra and BFS traverse. Because there is exactly one graph instance, a route
 * calculated on the home page and the matrix rendered on the Discrete Structures
 * page are always showing the same campus.
 *
 * Data flow:
 *   Firestore -> locations + edges -> buildGraph -> graph -> routing / map / views
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { buildGraph, computeStats, type CampusGraph } from '@/algorithms/graph';
import { subscribeToEdges } from '@/services/edges';
import { isFirebaseConfigured } from '@/services/firebase';
import { subscribeToLocations } from '@/services/locations';
import type { CampusEdge, CampusLocation, GraphStats } from '@/types/campus';

export type LoadStatus = 'initialising' | 'loading' | 'ready' | 'error';

interface CampusDataValue {
  status: LoadStatus;
  /** Human-readable reason the data could not be loaded, if any. */
  error: string | null;
  locations: CampusLocation[];
  edges: CampusEdge[];
  graph: CampusGraph;
  stats: GraphStats;
  /** Non-fatal problems found while assembling the graph (bad edge, duplicate…). */
  warnings: string[];
  /**
   * True while any location is still unverified. Drives the "provisional data"
   * banner so a visitor is never shown invented campus data as official.
   */
  hasProvisionalData: boolean;
  reload: () => void;
}

const CampusDataContext = createContext<CampusDataValue | null>(null);

export function CampusDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('initialising');
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [edges, setEdges] = useState<CampusEdge[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus('error');
      setError(
        'Firebase is not configured. Copy .env.example to .env.local, fill in the values, and restart the dev server.',
      );
      return;
    }

    let locationsReady = false;
    let edgesReady = false;
    let settled = false;

    setStatus('loading');
    setError(null);

    /** Waits for both listeners so the map never renders a half-built graph. */
    const maybeFinish = () => {
      if (locationsReady && edgesReady && !settled) {
        settled = true;
        setStatus((current) => (current === 'error' ? current : 'ready'));
      }
    };

    const fail = (message: string) => {
      settled = true;
      setError(message);
      setStatus('error');
    };

    const unsubscribeLocations = subscribeToLocations(
      (next) => {
        locationsReady = true;
        setLocations(next);
        maybeFinish();
      },
      (err) => fail(err.message),
    );

    const unsubscribeEdges = subscribeToEdges(
      (next) => {
        edgesReady = true;
        setEdges(next);
        maybeFinish();
      },
      (err) => fail(err.message),
    );

    return () => {
      unsubscribeLocations();
      unsubscribeEdges();
    };
  }, [attempt]);

  const { graph, warnings } = useMemo(
    () => buildGraph(locations, edges),
    [locations, edges],
  );

  const stats = useMemo(() => computeStats(graph), [graph]);

  const hasProvisionalData = useMemo(
    () => locations.some((location) => location.verified !== true),
    [locations],
  );

  const value = useMemo<CampusDataValue>(
    () => ({
      status,
      error,
      locations,
      edges,
      graph,
      stats,
      warnings,
      hasProvisionalData,
      reload: () => setAttempt((current) => current + 1),
    }),
    [status, error, locations, edges, graph, stats, warnings, hasProvisionalData],
  );

  return <CampusDataContext.Provider value={value}>{children}</CampusDataContext.Provider>;
}

export function useCampusData(): CampusDataValue {
  const context = useContext(CampusDataContext);
  if (!context) throw new Error('useCampusData must be used inside a CampusDataProvider.');
  return context;
}