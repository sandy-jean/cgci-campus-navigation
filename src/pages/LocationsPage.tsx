/**
 * Public directory of campus locations.
 *
 * A browsable, searchable list of every building, independent of routing. Useful on
 * its own for someone who just wants to know what exists, and as an accessible
 * alternative to picking buildings by clicking the map.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Clock, Layers } from 'lucide-react';

import { Badge, Card, EmptyState, ErrorState, SectionHeading, SkeletonCard } from '@/components/ui';
import { useCampusData } from '@/context/CampusDataContext';
import { rankLocations } from '@/utils/format';
import { CATEGORY_STYLES } from '@/utils/mapTheme';
import type { LocationCategory } from '@/types/campus';

export function LocationsPage() {
  const { graph, locations, status, error } = useCampusData();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | LocationCategory>('all');
  const navigate = useNavigate();

  const active = useMemo(
    () => [...graph.locations.values()],
    [graph],
  );

  const results = useMemo(() => {
    const byCategory =
      category === 'all' ? active : active.filter((location) => location.category === category);
    return rankLocations(byCategory, query, 100);
  }, [active, category, query]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const location of active) {
      map.set(location.category, (map.get(location.category) ?? 0) + 1);
    }
    return map;
  }, [active]);

  if (status === 'initialising' || status === 'loading') {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <ErrorState title="Campus directory unavailable" message={error ?? 'Unknown error.'} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <SectionHeading
        title="Campus locations"
        description={`${active.length} location${active.length === 1 ? '' : 's'} available for navigation.`}
      />

      {locations.some((location) => !location.verified) && (
        <p className="mb-5 rounded-md border border-route-100 bg-route-50 px-4 py-2.5 text-sm text-ink-700">
          Some entries below are provisional placeholders and have not been confirmed
          against official campus documentation.
        </p>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label htmlFor="directory-search" className="sr-only">
            Search the campus directory
          </label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search buildings, offices, laboratories…"
            className="w-full rounded-md border border-ink-300 bg-white px-3 py-2.5 text-sm hover:border-ink-400 focus:border-cgci-600"
          />
        </div>

        <div>
          <label htmlFor="directory-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="directory-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as 'all' | LocationCategory)}
            className="w-full rounded-md border border-ink-300 bg-white px-3 py-2.5 text-sm hover:border-ink-400 focus:border-cgci-600 sm:w-auto"
          >
            <option value="all">All categories ({active.length})</option>
            {Object.entries(CATEGORY_STYLES)
              .filter(([key]) => (counts.get(key) ?? 0) > 0)
              .map(([key, style]) => (
                <option key={key} value={key}>
                  {style.label} ({counts.get(key)})
                </option>
              ))}
          </select>
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} aria-hidden="true" />}
          title="Nothing matches that search"
          description="Try a shorter search term, or clear the category filter."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {results.map((location) => {
            const style = CATEGORY_STYLES[location.category] ?? CATEGORY_STYLES.facility;
            return (
              <li key={location.id}>
                <Card className="flex h-full flex-col p-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-md border-2 text-xs font-bold"
                      style={{
                        backgroundColor: style.fill,
                        borderColor: style.stroke,
                        color: style.text,
                      }}
                    >
                      {style.badge}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-ink-900">{location.name}</h2>
                      <p className="text-sm text-ink-600">{location.type}</p>
                    </div>
                  </div>

                  {location.description && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-700">
                      {location.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{style.label}</Badge>
                    {location.verified ? (
                      <Badge tone="green">Verified</Badge>
                    ) : (
                      <Badge tone="amber">Provisional</Badge>
                    )}
                  </div>

                  <dl className="mt-3 space-y-1 text-xs text-ink-600">
                    {location.facilities && location.facilities.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <Layers size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <dd className="min-w-0">{location.facilities.join(' · ')}</dd>
                      </div>
                    )}
                    {location.operatingHours && (
                      <div className="flex items-start gap-1.5">
                        <Clock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <dd>{location.operatingHours}</dd>
                      </div>
                    )}
                  </dl>

                  <button
                    type="button"
                    onClick={() => navigate('/', { state: { focusLocationId: location.id } })}
                    className="mt-4 self-start rounded-md border border-cgci-300 bg-cgci-50 px-3 py-2 text-sm font-medium text-cgci-800 transition hover:bg-cgci-100"
                  >
                    Show on map
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-sm text-ink-600">
        Ready to plan a journey?{' '}
        <Link to="/" className="font-medium text-cgci-700 underline underline-offset-2">
          Open campus navigation
        </Link>
        .
      </p>
    </div>
  );
}