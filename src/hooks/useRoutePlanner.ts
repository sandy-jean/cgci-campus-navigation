/**
 * Route planning hook.
 *
 * Bridges the UI state (which two locations the visitor picked) to the graph
 * algorithms. Keeping this out of the component means the page contains no
 * algorithm logic at all, which is exactly what the project brief asks for:
 * `dijkstra()` lives in `src/algorithms/dijkstra.ts` and nothing else does pathfinding.
 */

import { useCallback, useMemo } from 'react';

import { bfs, isReachable } from '@/algorithms/bfs';
import { dijkstra } from '@/algorithms/dijkstra';
import type { CampusGraph } from '@/algorithms/graph';
import { trackEvent } from '@/services/analytics';
import { useNavigationStore } from '@/store/navigationStore';
import type { PathResult } from '@/types/campus';
import { nodeName } from '@/algorithms/graph';

export interface RoutePlanner {
  /** Runs Dijkstra and records the outcome. Returns the result, or null if unusable. */
  findRoute: (graph: CampusGraph, originId: string, destinationId: string) => PathResult | null;
  /** Clears the active route and analytics event. */
  reset: () => void;
  /** Reachability check used to preview whether a pair can be connected. */
  canReach: (graph: CampusGraph, originId: string, destinationId: string) => boolean;
}

export function useRoutePlanner(): RoutePlanner {
  const setResult = useNavigationStore((state) => state.setResult);
  const setError = useNavigationStore((state) => state.setError);
  const resetStore = useNavigationStore((state) => state.reset);

  const findRoute = useCallback(
    (graph: CampusGraph, originId: string, destinationId: string) => {
      // Validated here rather than deep inside the algorithm, so the visitor gets a
      // message about their own input instead of an algorithm error.
      if (!graph.locations.has(originId)) {
        const message = 'Choose a valid starting location.';
        setError(message);
        void trackEvent('route_unavailable', {
          origin: originId,
          destination: destinationId,
          algorithm: 'dijkstra',
        });
        return null;
      }
      if (!graph.locations.has(destinationId)) {
        const message = 'Choose a valid destination.';
        setError(message);
        void trackEvent('route_unavailable', {
          origin: originId,
          destination: destinationId,
          algorithm: 'dijkstra',
        });
        return null;
      }

      const result = dijkstra(graph, originId, destinationId);

      if (!result.reachable) {
        setError(
          `No route available. ${nodeName(graph, destinationId)} cannot be reached from ${nodeName(graph, originId)} on the paths currently open.`,
        );
        void trackEvent('route_unavailable', {
          origin: originId,
          destination: destinationId,
          algorithm: 'dijkstra',
        });
        return result;
      }

      setResult(result, 'ready');
      void trackEvent('route_requested', {
        origin: originId,
        destination: destinationId,
        algorithm: 'dijkstra',
      });
      void trackEvent('route_completed', {
        origin: originId,
        destination: destinationId,
        algorithm: 'dijkstra',
        distance: result.distance,
        hops: result.path.length - 1,
      });
      return result;
    },
    [setError, setResult],
  );

  const reset = useCallback(() => {
    resetStore();
    void trackEvent('navigation_reset', {});
  }, [resetStore]);

  const canReach = useCallback(
    (graph: CampusGraph, originId: string, destinationId: string) =>
      isReachable(graph, originId, destinationId),
    [],
  );

  return useMemo(() => ({ findRoute, reset, canReach }), [findRoute, reset, canReach]);
}

/**
 * Breadth-first exploration order from a node, used by the Discrete Structures
 * page to show BFS running against the live campus graph.
 */
export function useBfsOrder(graph: CampusGraph, startId: string | null) {
  return useMemo(() => {
    if (!startId || !graph.locations.has(startId)) return null;
    const result = bfs(graph, startId);
    return { order: result.order, hops: result.hops };
  }, [graph, startId]);
}