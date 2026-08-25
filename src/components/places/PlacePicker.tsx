"use client";

import { useMemo, useState } from "react";
import type { TripPlace } from "@/core/models";
import type { PlaceSearchResult } from "@/core/places/types";
import { placesRepo } from "@/services/repositories";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { reverseGeocode } from "@/services/api/places";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { FavouriteIcon, VisitedIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/Misc";
import { errorMessage } from "@/lib/errors";
import { MapCanvas } from "@/components/map/MapCanvas";
import { PlaceSearchInput } from "./PlaceSearchInput";

type Tab = "trip" | "search" | "map";

/**
 * Selector de lugar con las tres vias del brief:
 *  A) elegir un lugar ya presente en el viaje
 *  B) buscar un lugar real y anadirlo automaticamente al viaje/mapa
 *  C) marcar un punto en el mapa (se resuelve por geocodificacion inversa)
 */
export function PlacePicker({
  open,
  onClose,
  onSelect,
  title = "Seleccionar lugar",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (tripPlace: TripPlace) => void;
  title?: string;
}) {
  const { trip, tripPlaces, center, refresh } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>(tripPlaces.length ? "trip" : "search");
  const [pending, setPending] = useState<{ latitude: number; longitude: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const markers = useMemo(
    () =>
      tripPlaces.map((tp) => ({
        id: tp.id,
        latitude: tp.place.latitude,
        longitude: tp.place.longitude,
        label: tp.place.name,
      })),
    [tripPlaces],
  );

  async function addFromSearch(result: PlaceSearchResult) {
    if (!trip || !session?.user) return;
    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const tripPlace = await placesRepo.addToTrip(db, trip.id, session.user.id, result);
      await refresh();
      onSelect(tripPlace);
      onClose();
      toast(`“${tripPlace.place.name}” añadido al viaje`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function addFromMap() {
    if (!pending) return;
    setSaving(true);
    try {
      const resolved = await reverseGeocode(pending.latitude, pending.longitude);
      await addFromSearch(
        resolved ?? {
          provider: "manual",
          externalPlaceId: null,
          name: "Punto del mapa",
          address: `${pending.latitude.toFixed(5)}, ${pending.longitude.toFixed(5)}`,
          city: null,
          country: null,
          countryCode: null,
          latitude: pending.latitude,
          longitude: pending.longitude,
          category: null,
          image: null,
        },
      );
      setPending(null);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "trip", label: "Del viaje", count: tripPlaces.length },
            { value: "search", label: "Buscar lugar" },
            { value: "map", label: "En el mapa" },
          ]}
        />

        {tab === "trip" &&
          (tripPlaces.length ? (
            <ul className="app-scroll-y max-h-[min(20rem,45dvh)] divide-y divide-[var(--border-subtle)] rounded-xl border border-subtle">
              {tripPlaces.map((tp) => (
                <li key={tp.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(tp);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:surface-2"
                  >
                    {tp.status === "visited" ? (
                      <VisitedIcon size={18} weight="fill" className="text-emerald-500" aria-hidden />
                    ) : (
                      <FavouriteIcon size={18} weight="fill" className="text-rose-400" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium ink-primary">
                        {tp.place.name}
                      </span>
                      {tp.place.address && (
                        <span className="block truncate text-xs ink-muted">{tp.place.address}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-subtle px-4 py-8 text-center text-sm ink-muted">
              Todavía no hay lugares en este viaje. Búscalos en la pestaña siguiente.
            </p>
          ))}

        {tab === "search" && (
          <PlaceSearchInput autoFocus bias={center} onSelect={(r) => void addFromSearch(r)} />
        )}

        {tab === "map" && (
          <div className="space-y-3">
            <div className="h-[min(18rem,45dvh)] overflow-hidden rounded-xl border border-subtle">
              <MapCanvas
                markers={
                  pending
                    ? [{ id: "pending", ...pending, label: "Punto elegido", badge: "pin" }]
                    : markers
                }
                initialCenter={center}
                autoFit={!pending}
                onMapClick={setPending}
              />
            </div>
            <p className="text-xs ink-muted">
              Toca el mapa para elegir un punto. Resolveremos su dirección automáticamente.
            </p>
            <Button onClick={() => void addFromMap()} disabled={!pending} loading={saving}>
              Usar este punto
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
