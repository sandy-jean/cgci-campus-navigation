/**
 * Campus search.
 *
 * Keyboard support beyond the basics: ArrowDown / ArrowUp move through the
 * results, Enter opens the highlighted one, and Escape closes the list. The input
 * follows the ARIA combobox pattern with `aria-activedescendant`, so a screen
 * reader announces the highlighted option without focus leaving the text field.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';

import type { CampusLocation } from '@/types/campus';
import { rankLocations } from '@/utils/format';
import { CATEGORY_STYLES } from '@/utils/mapTheme';
import { trackEvent } from '@/services/analytics';

interface SearchBarProps {
  locations: CampusLocation[];
  onChoose: (id: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  locations,
  onChoose,
  placeholder = 'Search buildings, offices, facilities…',
  className,
  autoFocus,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => rankLocations(locations, query, 8), [locations, query]);

  // Close the list when focus or a click leaves the component.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const commit = (location: CampusLocation | undefined) => {
    if (!location) return;
    void trackEvent('location_search', {
      termLength: query.trim().length,
      resultCount: results.length,
    });
    void trackEvent('location_selected', { locationId: location.id, source: 'search' });
    onChoose(location.id);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search campus locations
      </label>
      <div className="relative">
        <Search
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
        />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, -1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              commit(activeIndex >= 0 ? results[activeIndex] : results[0]);
            } else if (event.key === 'Escape') {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          className="w-full rounded-md border border-ink-300 bg-white py-2.5 pr-9 pl-9 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-400 focus:border-cgci-600"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setActiveIndex(-1);
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        >
          {results.map((location, index) => {
            const style = CATEGORY_STYLES[location.category] ?? CATEGORY_STYLES.facility;
            return (
              <li key={location.id} role="none">
                <button
                  type="button"
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(location)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    index === activeIndex ? 'bg-cgci-50' : 'hover:bg-ink-50'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded border-2 text-[10px] font-bold"
                    style={{ backgroundColor: style.fill, borderColor: style.stroke, color: style.text }}
                  >
                    {style.badge}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {location.name}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {style.label}
                      {location.verified ? '' : ' · provisional'}
                    </span>
                  </span>
                  <MapPin size={15} className="shrink-0 text-ink-300" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-ink-200 bg-white px-3 py-3 text-sm text-ink-600 shadow-lg">
          No location matches “{query.trim()}”.
        </div>
      )}
    </div>
  );
}