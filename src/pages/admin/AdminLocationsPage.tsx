/**
 * Admin: campus locations (the vertices of G).
 *
 * Creating, editing, deactivating and verifying locations all write through to
 * Firestore for real. Nothing here is simulated: the table reflects the live
 * listener from CampusDataContext, so a save is visible immediately.
 *
 * Deactivation is offered instead of deletion by default, because hard-deleting a
 * vertex would orphan every edge that referenced it. Permanent deletion is available
 * behind an explicit confirmation that states exactly what will be removed.
 */

import { useMemo, useState } from 'react';
import { Building2, MapPin, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';

import { Badge, Button, Card, EmptyState, ErrorState, SectionHeading, SkeletonCard } from '@/components/ui';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/forms';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCampusData } from '@/context/CampusDataContext';
import { trackEvent } from '@/services/analytics';
import {
  deactivateLocation,
  deleteLocationCascade,
  reactivateLocation,
  saveLocation,
} from '@/services/locations';
import { edgesTouching } from '@/services/edges';
import { slugify, formatDate } from '@/utils/format';
import { CATEGORY_STYLES } from '@/utils/mapTheme';
import type { CampusLocation, LocationCategory } from '@/types/campus';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_STYLES) as LocationCategory[]).map((key) => ({
  value: key,
  label: CATEGORY_STYLES[key].label,
}));

type Draft = Omit<CampusLocation, 'id'> & { id?: string };

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  category: 'academic',
  type: 'Academic Facility',
  x: 500,
  y: 350,
  isActive: true,
  verified: false,
  keywords: [],
  facilities: [],
  operatingHours: '',
  sortOrder: 99,
};

export function AdminLocationsPage() {
  const { locations, edges, status, error, reload } = useCampusData();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CampusLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...locations]
      .filter((location) => !term || `${location.name} ${location.type}`.toLowerCase().includes(term))
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));
  }, [locations, query]);

  if (status === 'initialising' || status === 'loading') return <SkeletonCard />;
  if (status === 'error') return <ErrorState message={error ?? 'Unknown error.'} />;

  const openCreate = () => {
    setFormError(null);
    setEditing({ ...EMPTY_DRAFT });
  };

  const openEdit = (location: CampusLocation) => {
    setFormError(null);
    setEditing({ ...location });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const id = editing.id ?? slugify(editing.name);
    if (!id) {
      setFormError('Enter a name that can form a document id (letters and numbers).');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const payload: CampusLocation = {
        ...editing,
        id,
        keywords: editing.keywords ?? [],
        facilities: editing.facilities ?? [],
      };
      await saveLocation(payload);
      setEditing(null);
      const isNew = !editing.id;
      void trackEvent(isNew ? 'location_created' : 'location_updated', {
        category: payload.category,
      });
      toast.success(`${payload.name} saved to Firestore.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the location.';
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (location: CampusLocation) => {
    try {
      if (location.isActive) {
        await deactivateLocation(location.id);
        void trackEvent('location_deactivated', {});
        toast.success(`${location.name} taken out of service. Its paths are preserved.`);
      } else {
        await reactivateLocation(location.id);
        toast.success(`${location.name} is active again.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The change could not be saved.');
    }
  };

  const toggleVerified = async (location: CampusLocation) => {
    try {
      await saveLocation({ ...location, verified: !location.verified });
      toast.success(
        location.verified
          ? `${location.name} is now marked provisional again.`
          : `${location.name} confirmed against campus documentation.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The change could not be saved.');
    }
  };

  const confirmPermanentDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    const touching = edgesTouching(edges, target.id);
    setBusy(true);
    try {
      await deleteLocationCascade(target.id, touching.map((edge) => edge.id));
      void trackEvent('location_deactivated', {});
      toast.success(`${target.name} and ${touching.length} connected path(s) deleted.`);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The deletion could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Campus locations"
        description="Each row is one vertex in the campus graph. Coordinates place the building on the 1000 × 700 map."
        action={
          <Button onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            Add location
          </Button>
        }
      />

      <Card className="p-4">
        <label htmlFor="location-filter" className="sr-only">
          Filter locations
        </label>
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
          <input
            id="location-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name or type…"
            className="w-full rounded-md border border-ink-300 bg-white py-2.5 pr-3 pl-9 text-sm hover:border-ink-400 focus:border-cgci-600"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} aria-hidden="true" />}
          title={query ? 'No location matches that filter' : 'No locations yet'}
          description={
            query
              ? 'Try a different search term.'
              : 'Add the first campus building to begin building the graph.'
          }
          action={!query && <Button onClick={openCreate}>Add the first location</Button>}
        />
      ) : (
        <>
          {/* Table on wide screens */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-ink-50">
                  <tr className="text-left">
                    <Th>Building</Th>
                    <Th>Category</Th>
                    <Th>Map position</Th>
                    <Th>Paths</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((location) => {
                    const count = edgesTouching(edges, location.id).length;
                    return (
                      <tr key={location.id} className="border-t border-ink-200 align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink-900">{location.name}</p>
                          <p className="text-xs text-ink-500">
                            {location.type} · <code className="text-[11px]">{location.id}</code>
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="neutral">{CATEGORY_STYLES[location.category]?.label}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-600 tabular-nums">
                          {Math.round(location.x)}, {Math.round(location.y)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{count}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {location.isActive ? (
                              <Badge tone="green">Active</Badge>
                            ) : (
                              <Badge tone="red">Out of service</Badge>
                            )}
                            {location.verified ? (
                              <Badge tone="green">Verified</Badge>
                            ) : (
                              <Badge tone="amber">Provisional</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <IconButton label={`Edit ${location.name}`} onClick={() => openEdit(location)}>
                              <Pencil size={15} />
                            </IconButton>
                            <IconButton
                              label={location.verified ? `Mark ${location.name} provisional` : `Confirm ${location.name}`}
                              onClick={() => void toggleVerified(location)}
                            >
                              <MapPin size={15} />
                            </IconButton>
                            <IconButton
                              label={location.isActive ? `Take ${location.name} out of service` : `Reactivate ${location.name}`}
                              onClick={() => void toggleActive(location)}
                            >
                              <RotateCcw size={15} />
                            </IconButton>
                            <IconButton
                              label={`Permanently delete ${location.name}`}
                              tone="danger"
                              onClick={() => setConfirmDelete(location)}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Cards on narrow screens */}
          <ul className="space-y-3 md:hidden">
            {filtered.map((location) => {
              const count = edgesTouching(edges, location.id).length;
              return (
                <li key={location.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink-900">{location.name}</p>
                        <p className="text-xs text-ink-500">
                          {location.type} · {count} path{count === 1 ? '' : 's'} · ({Math.round(location.x)},{' '}
                          {Math.round(location.y)})
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {location.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Out of service</Badge>}
                        {location.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Provisional</Badge>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(location)}>
                        <Pencil size={14} aria-hidden="true" /> Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void toggleVerified(location)}>
                        {location.verified ? 'Mark provisional' : 'Confirm'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void toggleActive(location)}>
                        {location.isActive ? 'Take offline' : 'Reactivate'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirmDelete(location)}>
                        <Trash2 size={14} aria-hidden="true" /> Delete
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {locations.length > 0 && (
        <p className="text-xs text-ink-500">
          {locations.length} location(s) stored. Last list refresh: {formatDate(new Date())}.
          <button type="button" onClick={reload} className="ml-2 underline underline-offset-2">
            Refresh
          </button>
        </p>
      )}

      {/* ------------------------------- Editor ------------------------------- */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${editing.name}` : 'Add a campus location'}
        description="Fields marked with an asterisk are required. Positions are in map units (canvas is 1000 × 700)."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Save to Firestore'}
            </Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              required
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              placeholder="Library"
              className="sm:col-span-2"
            />

            <TextField
              label="Type"
              value={editing.type}
              onChange={(event) => setEditing({ ...editing, type: event.target.value })}
              placeholder="Academic Facility"
            />

            <SelectField
              label="Category"
              value={editing.category}
              options={CATEGORY_OPTIONS}
              onChange={(event) =>
                setEditing({ ...editing, category: event.target.value as LocationCategory })
              }
            />

            <TextField
              label="Map X"
              type="number"
              min={0}
              max={1000}
              required
              value={editing.x}
              onChange={(event) => setEditing({ ...editing, x: Number(event.target.value) })}
            />

            <TextField
              label="Map Y"
              type="number"
              min={0}
              max={700}
              required
              value={editing.y}
              onChange={(event) => setEditing({ ...editing, y: Number(event.target.value) })}
            />

            <TextAreaField
              label="Description"
              value={editing.description ?? ''}
              onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              placeholder="What this location is for."
              className="sm:col-span-2"
            />

            <TextField
              label="Facilities"
              hint="Comma separated. Shown as tags on the public map."
              value={(editing.facilities ?? []).join(', ')}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  facilities: event.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Study hall, Reading area"
              className="sm:col-span-2"
            />

            <TextField
              label="Search keywords"
              hint="Comma separated. Improve how the location appears in search."
              value={(editing.keywords ?? []).join(', ')}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  keywords: event.target.value
                    .split(',')
                    .map((value) => value.trim().toLowerCase())
                    .filter(Boolean),
                })
              }
              placeholder="library, books, study"
              className="sm:col-span-2"
            />

            <TextField
              label="Operating hours"
              value={editing.operatingHours ?? ''}
              onChange={(event) => setEditing({ ...editing, operatingHours: event.target.value })}
              placeholder="Weekdays, library hours"
            />

            <TextField
              label="Photograph URL"
              value={editing.image ?? ''}
              onChange={(event) => setEditing({ ...editing, image: event.target.value })}
              placeholder="https://… (optional)"
            />

            <div className="space-y-3 sm:col-span-2">
              <CheckboxField
                label="Active on the public map"
                hint="Inactive locations are excluded from routing but keep their history."
                checked={editing.isActive}
                onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })}
              />
              <CheckboxField
                label="Verified against official campus documentation"
                hint="Leave unchecked for provisional placeholders. Once every location is verified the public warning banner disappears."
                checked={Boolean(editing.verified)}
                onChange={(event) => setEditing({ ...editing, verified: event.target.checked })}
              />
            </div>

            {formError && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2">
                {formError}
              </p>
            )}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        busy={busy}
        title="Permanently delete this location?"
        confirmLabel="Delete permanently"
        message={
          confirmDelete
            ? `“${confirmDelete.name}” will be removed from Firestore, along with ${
                edgesTouching(edges, confirmDelete.id).length
              } connected path(s). This cannot be undone. Consider taking it out of service instead, which keeps its history.`
            : ''
        }
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmPermanentDelete}
      />
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th scope="col" className={`px-4 py-2.5 font-semibold text-ink-700 ${className ?? ''}`}>
      {children}
    </th>
  );
}

function IconButton({
  children,
  onClick,
  label,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md border p-2 transition ${
        tone === 'danger'
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-ink-300 text-ink-600 hover:bg-ink-50 hover:text-ink-900'
      }`}
    >
      {children}
    </button>
  );
}