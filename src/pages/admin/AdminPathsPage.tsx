/**
 * Admin: walking paths (the edges of G), including the visual graph editor.
 *
 * "Create a path" is the form from the project brief: pick two buildings, enter the
 * distance, save. The distance is the edge weight Dijkstra minimises, so it is
 * validated as a positive number of metres with a clear message when it is not.
 *
 * A path is closed by setting `walkable: false` rather than deleted, so a
 * temporarily closed walkway keeps its weight and can be reopened with one click.
 * That is also the clearest way to demonstrate Dijkstra reacting to a graph change
 * during a presentation: close one path, recalculate, watch the route move.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, Plus, Route as RouteIcon, Search } from 'lucide-react';

import { Badge, Button, Card, EmptyState, ErrorState, SectionHeading, SkeletonCard } from '@/components/ui';
import { SelectField, TextField } from '@/components/ui/forms';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCampusData } from '@/context/CampusDataContext';
import { trackEvent } from '@/services/analytics';
import {
  deleteEdge,
  edgeIdFor,
  saveEdge,
  setEdgeWalkable,
  validateEdge,
} from '@/services/edges';
import type { CampusEdge } from '@/types/campus';

export function AdminPathsPage() {
  const { graph, edges, status, error } = useCampusData();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CampusEdge | null>(null);
  const [removing, setRemoving] = useState<CampusEdge | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) => graph.locations.get(id)?.name ?? id;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...edges]
      .filter((edge) => !term || `${nameOf(edge.from)} ${nameOf(edge.to)} ${edge.note ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => nameOf(a.from).localeCompare(nameOf(b.from)) || a.distance - b.distance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, query, graph]);

  if (status === 'initialising' || status === 'loading') return <SkeletonCard />;
  if (status === 'error') return <ErrorState message={error ?? 'Unknown error.'} />;

  const toggleWalkable = async (edge: CampusEdge) => {
    try {
      await setEdgeWalkable(edge.id, !edge.walkable);
      void trackEvent('edge_updated', {});
      toast.success(
        edge.walkable
          ? `${nameOf(edge.from)} ↔ ${nameOf(edge.to)} closed. Dijkstra will now route around it.`
          : `${nameOf(edge.from)} ↔ ${nameOf(edge.to)} reopened.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The change could not be saved.');
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteEdge(removing.id);
      void trackEvent('edge_deleted', {});
      toast.success(`Path ${nameOf(removing.from)} ↔ ${nameOf(removing.to)} removed.`);
      setRemoving(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The path could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Walking paths"
        description="Each row is one edge in the campus graph. Distance is the weight in metres that the shortest-path algorithm minimises."
        action={
          <Button
            onClick={() => setCreating(true)}
            disabled={graph.locations.size < 2}
            title={graph.locations.size < 2 ? 'Add at least two locations first' : undefined}
          >
            <Plus size={16} aria-hidden="true" />
            Create path
          </Button>
        }
      />

      <Card className="p-4">
        <label htmlFor="path-filter" className="sr-only">
          Filter paths
        </label>
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
          <input
            id="path-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter paths…"
            className="w-full rounded-md border border-ink-300 bg-white py-2.5 pr-3 pl-9 text-sm hover:border-ink-400 focus:border-cgci-600"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<RouteIcon size={28} aria-hidden="true" />}
          title={query ? 'No path matches that filter' : 'No walking paths yet'}
          description={
            query
              ? 'Try a different search term.'
              : 'A graph with no edges has no routes. Connect two buildings to create the first path.'
          }
          action={
            !query && (
              <Button onClick={() => setCreating(true)} disabled={graph.locations.size < 2}>
                Create the first path
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-200">
            {filtered.map((edge) => (
              <li key={edge.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <span className="truncate font-medium text-ink-900">{nameOf(edge.from)}</span>
                  <ArrowRight size={14} className="shrink-0 text-ink-400" aria-hidden="true" />
                  <span className="truncate font-medium text-ink-900">{nameOf(edge.to)}</span>
                  {edge.direction !== 'both' && (
                    <Badge tone="blue">
                      {edge.direction === 'forward' ? 'One way: this way only' : 'One way: return only'}
                    </Badge>
                  )}
                  {!edge.walkable && <Badge tone="red">Closed</Badge>}
                </div>

                <div className="w-24 shrink-0 text-right">
                  <span className="font-mono text-sm font-semibold text-ink-900 tabular-nums">
                    {edge.distance} m
                  </span>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(edge)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void toggleWalkable(edge)}>
                    {edge.walkable ? 'Close' : 'Reopen'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setRemoving(edge)}>
                    Remove
                  </Button>
                </div>

                {edge.note && (
                  <p className="w-full text-xs text-ink-500">{edge.note}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------ Editor ------------------------------ */}
      <PathEditor
        open={creating || editing !== null}
        edge={editing}
        validIds={new Set(graph.locations.keys())}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(isNew) => {
          void trackEvent(isNew ? 'edge_created' : 'edge_updated', {});
          setCreating(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        busy={busy}
        title="Remove this walking path?"
        confirmLabel="Remove path"
        message={
          removing
            ? `The connection between ${nameOf(removing.from)} and ${nameOf(removing.to)} will be deleted from Firestore. Any route that relied on it will be recalculated without it.`
            : ''
        }
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

/* --------------------------------------------------------------- Editor form */

function PathEditor({
  open,
  edge,
  validIds,
  onClose,
  onSaved,
}: {
  open: boolean;
  edge: CampusEdge | null;
  validIds: Set<string>;
  onClose: () => void;
  onSaved: (isNew: boolean) => void;
}) {
  const { graph } = useCampusData();
  const toast = useToast();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [distance, setDistance] = useState('');
  const [direction, setDirection] = useState<CampusEdge['direction']>('both');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset the form whenever the dialog opens, seeding from the edge being edited.
  const [seed, setSeed] = useState<string | null>(null);
  const key = edge?.id ?? (open ? 'new' : null);
  if (key && seed !== key) {
    setSeed(key);
    setFrom(edge?.from ?? '');
    setTo(edge?.to ?? '');
    setDistance(edge ? String(edge.distance) : '');
    setDirection(edge?.direction ?? 'both');
    setNote(edge?.note ?? '');
    setErrors([]);
  }

  const options = [...graph.locations.values()]
    .filter((location) => location.isActive)
    .map((location) => ({ value: location.id, label: location.name }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = {
      id: edge?.id ?? '',
      from,
      to,
      distance: Number(distance),
      walkable: edge?.walkable ?? true,
      direction,
      note,
    };

    const validation = validateEdge(candidate, validIds);
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      // Undirected pairs collapse onto one document id, so creating the same
      // connection in the opposite order updates the existing path rather than
      // adding a duplicate edge.
      const id = edge?.id ?? edgeIdFor(from, to);
      await saveEdge({ ...candidate, id });
      toast.success(
        `Path saved. ${candidate.distance} m between ${graph.locations.get(from)?.name} and ${graph.locations.get(to)?.name}.`,
      );
      setSeed(null);
      onSaved(!edge);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The path could not be saved.';
      setErrors([message]);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setSeed(null);
        onClose();
      }}
      title={edge ? 'Edit walking path' : 'Create a walking path'}
      description="Two buildings plus the distance between them define one edge of the campus graph."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              setSeed(null);
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : edge ? 'Save changes' : 'Create path'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="From"
            required
            placeholder="Select a location"
            value={from}
            options={options}
            error={errors.find((error) => error.includes('starting location') || error.includes('same location'))}
            onChange={(event) => setFrom(event.target.value)}
          />
          <SelectField
            label="To"
            required
            placeholder="Select a location"
            value={to}
            options={options}
            error={errors.find((error) => error.includes('destination'))}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>

        <TextField
          label="Distance"
          required
          type="number"
          min={1}
          step={1}
          value={distance}
          onChange={(event) => setDistance(event.target.value)}
          error={errors.find((error) => error.includes('Distance'))}
          hint="In metres. This is the edge weight the shortest-path algorithm minimises."
          placeholder="45"
        />

        <SelectField
          label="Direction"
          value={direction}
          onChange={(event) => setDirection(event.target.value as CampusEdge['direction'])}
          options={[
            { value: 'both', label: 'Both ways (default campus walkway)' },
            { value: 'forward', label: 'One way: From → To only' },
            { value: 'backward', label: 'One way: To → From only' },
          ]}
          hint="A one-way path produces an asymmetric adjacency matrix and a directed reachability result."
        />

        <TextField
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Closed for resurfacing until Friday"
        />

        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </form>
    </Modal>
  );
}