"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaceSearchResult } from "@/core/places/types";
import { searchPlaces } from "@/services/api/places";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { errorMessage } from "@/lib/errors";
import { inputClass } from "@/components/ui/Field";
import { PlaceIcon, SearchIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Buscador de lugares REALES. El usuario nunca escribe una direccion a mano:
 * escribe "Senso-ji" y elige un resultado con coordenadas y direccion reales.
 */
export function PlaceSearchInput({
  onSelect,
  bias,
  placeholder = "Busca un lugar real…  (Senso-ji, Akihabara, Sagrada Família)",
  autoFocus,
}: {
  onSelect: (result: PlaceSearchResult) => void;
  bias?: { latitude: number; longitude: number } | null;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const debounced = useDebouncedValue(query, 350);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = debounced.trim();
    abortRef.current?.abort();

    if (term.length < 3) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    searchPlaces(term, { bias: bias ?? undefined, signal: controller.signal })
      .then((found) => {
        if (!controller.signal.aborted) setResults(found);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(err, "No se ha podido buscar el lugar."));
        setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debounced, bias?.latitude, bias?.longitude]);

  const term = query.trim();

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base" aria-hidden>
          <SearchIcon size={16} weight="bold" aria-hidden />
        </span>
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setTouched(true);
          }}
          placeholder={placeholder}
          className={cn(inputClass, "pl-10")}
          aria-label="Buscar lugar"
        />
        {loading && (
          <Spinner className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ink-muted" />
        )}
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {!error && touched && term.length > 0 && term.length < 3 && (
        <p className="text-sm ink-muted">Escribe al menos 3 caracteres.</p>
      )}

      {!error && !loading && term.length >= 3 && results.length === 0 && (
        <p className="text-sm ink-muted">Sin resultados para “{term}”.</p>
      )}

      {results.length > 0 && (
        <ul className="app-scroll-y max-h-[min(18rem,40dvh)] divide-y divide-[var(--border-subtle)] rounded-xl border border-subtle">
          {results.map((result, index) => (
            <li key={`${result.externalPlaceId ?? "n"}-${index}`}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:surface-2"
              >
                <PlaceIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-brand-500" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium ink-primary">{result.name}</span>
                  {result.address && (
                    <span className="block truncate text-xs ink-muted">{result.address}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
