/**
 * Building information panel.
 *
 * Shown when a visitor selects a building on the map, in the search results, or as
 * a step on the route. Every field degrades to "not provided" rather than rendering
 * an empty block, and the provisional-data notice is stated here too - the panel is
 * the detail view, so it is where a reader will look for the caveat.
 */

import {
  Building2,
  CalendarClock,
  ChevronRight,
  ImageOff,
  Layers,
} from 'lucide-react';

import type { CampusLocation } from '@/types/campus';
import { Badge, Card } from '@/components/ui';
import { formatList } from '@/utils/format';
import { CATEGORY_STYLES } from '@/utils/mapTheme';
import { useEffect } from 'react';
import { trackEvent } from '@/services/analytics';

interface BuildingDetailsProps {
  location: CampusLocation | null;
  /** Shows the "use as start" / "use as destination" actions when provided. */
  onUseAsOrigin?: (id: string) => void;
  onUseAsDestination?: (id: string) => void;
  onClose?: () => void;
}

export function BuildingDetails({
  location,
  onUseAsOrigin,
  onUseAsDestination,
  onClose,
}: BuildingDetailsProps) {
  // Recorded when the panel opens, not on every re-render.
  useEffect(() => {
    if (location) void trackEvent('building_viewed', { locationId: location.id });
  }, [location]);

  if (!location) {
    return (
      <Card className="border-dashed p-4 text-center text-sm text-ink-500">
        Select a building on the map to see its details.
      </Card>
    );
  }

  const style = CATEGORY_STYLES[location.category] ?? CATEGORY_STYLES.facility;

  return (
    <Card className="overflow-hidden">
      {/* Building photograph, when an administrator has uploaded one. */}
      {location.image ? (
        <img
          src={location.image}
          alt={`${location.name}`}
          loading="lazy"
          className="h-36 w-full object-cover sm:h-44"
        />
      ) : (
        <div
          className="flex h-28 items-center justify-center gap-2 text-sm sm:h-32"
          style={{ backgroundColor: style.fill, color: style.text }}
        >
          <ImageOff size={18} aria-hidden="true" />
          <span>No photograph on file</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-semibold text-ink-900">
              {location.name}
            </h2>
            <p className="mt-0.5 text-sm text-ink-600">{location.type}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close building details"
              className="shrink-0 rounded-md p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            >
              <ChevronRight size={18} className="rotate-90" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="neutral" className="border">
            <Building2 size={12} aria-hidden="true" />
            {style.label}
          </Badge>
          {location.verified ? (
            <Badge tone="green">Name from the official site map</Badge>
          ) : (
            <Badge tone="amber">Building not yet named by the college</Badge>
          )}
          {!location.isActive && <Badge tone="red">Out of service</Badge>}
        </div>

        {location.description && (
          <p className="mt-3 text-sm leading-relaxed text-ink-700">{location.description}</p>
        )}

        <dl className="mt-4 space-y-3 text-sm">
          {location.facilities && location.facilities.length > 0 && (
            <div>
              <dt className="flex items-center gap-1.5 font-medium text-ink-800">
                <Layers size={14} aria-hidden="true" />
                Facilities
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {location.facilities.map((facility) => (
                  <Badge key={facility} tone="neutral">
                    {facility}
                  </Badge>
                ))}
              </dd>
            </div>
          )}

          {location.operatingHours && (
            <div>
              <dt className="flex items-center gap-1.5 font-medium text-ink-800">
                <CalendarClock size={14} aria-hidden="true" />
                Operating hours
              </dt>
              <dd className="mt-0.5 text-ink-700">{location.operatingHours}</dd>
            </div>
          )}
        </dl>

        {(onUseAsOrigin || onUseAsDestination) && (
          <div className="mt-4 flex flex-col gap-2 border-t border-ink-200 pt-4 sm:flex-row">
            {onUseAsOrigin && (
              <button
                type="button"
                onClick={() => onUseAsOrigin(location.id)}
                className="flex-1 rounded-md border border-cgci-300 bg-cgci-50 px-3 py-2 text-sm font-medium text-cgci-800 transition hover:bg-cgci-100"
              >
                Travel from here
              </button>
            )}
            {onUseAsDestination && (
              <button
                type="button"
                onClick={() => onUseAsDestination(location.id)}
                className="flex-1 rounded-md border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
              >
                Travel to here
              </button>
            )}
          </div>
        )}

        {!location.verified && (
          <p className="mt-4 rounded-md bg-route-50 px-3 py-2 text-xs leading-relaxed text-ink-700">
            The official CGCI campus site map has not yet given this building a name —
            it is still labelled “BLDG. NAME” on the plan. The name shown here was
            taken from the functions the map documents inside it, so that the location
            can still be routed to. An administrator can replace it with the official
            name from the admin dashboard.
          </p>
        )}

        {location.facilities && location.facilities.length > 0 && (
          <p className="sr-only">
            Facilities available: {formatList(location.facilities)}.
          </p>
        )}
      </div>
    </Card>
  );
}