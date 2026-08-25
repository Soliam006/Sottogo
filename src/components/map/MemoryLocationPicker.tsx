"use client";

import { useState } from "react";
import type { PlaceSearchResult } from "@/core/places/types";
import { geolocationMessage, type MemoryLocation } from "@/core/map/location";
import { placesRepo } from "@/services/repositories";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { reverseGeocode } from "@/services/api/places";
import { useTrip } from "@/components/providers/TripProvider";
import { Modal } from "@/components/ui/Modal";
import { Button, Spinner } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/Misc";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";
import { MapCanvas } from "./MapCanvas";

type Tab = "current" | "search" | "map";

/**
 * "📍 ¿Dónde ocurrió?" — ubicacion EXACTA de una foto o un momento.
 *
 * A diferencia de `PlacePicker`, este selector NO crea un lugar del itinerario
 * ni exige que exista un `Place`: devuelve coordenadas y, como mucho, un nombre.
 * `placeId` solo se rellena en la via de busqueda, y de forma best-effort.
 */
export function MemoryLocationPicker({
  open,
  onClose,
  onSelect,
  title = "¿Dónde ocurrió?",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (location: MemoryLocation) => void;
  title?: string;
}) {
  const { center } = useTrip();

  const [tab, setTab] = useState<Tab>("current");
  const [pending, setPending] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish(location: MemoryLocation) {
    setPending(null);
    setError(null);
    onSelect(location);
    onClose();
  }

  // --- 1. Mi ubicacion actual (Geolocation API) -----------------------------
  function useCurrentLocation() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no permite compartir la ubicación.");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // El nombre es un extra: si la geocodificacion falla, las coordenadas
        // siguen siendo validas y el recuerdo se guarda igual.
        let name: string | null = null;
        try {
          const found = await reverseGeocode(latitude, longitude);
          name = found?.name ?? null;
        } catch {
          name = null;
        }
        setBusy(false);
        finish({ latitude, longitude, name, placeId: null, source: "current" });
      },
      (positionError) => {
        setBusy(false);
        setError(geolocationMessage(positionError.code));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // --- 2. Buscar ubicacion --------------------------------------------------
  async function chooseSearchResult(result: PlaceSearchResult) {
    setError(null);
    setBusy(true);
    // El Place del catalogo es opcional: si el alta falla, guardamos igualmente
    // coordenadas y nombre.
    let placeId: string | null = null;
    try {
      const place = await placesRepo.upsertPlace(getSupabaseBrowserClient(), result);
      placeId = place.id;
    } catch {
      placeId = null;
    }
    setBusy(false);
    finish({
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
      placeId,
      source: "search",
    });
  }

  // --- 3. Marcar en el mapa -------------------------------------------------
  async function confirmMapPoint() {
    if (!pending) return;
    setBusy(true);
    let name: string | null = null;
    try {
      const found = await reverseGeocode(pending.latitude, pending.longitude);
      name = found?.name ?? null;
    } catch {
      name = null;
    }
    setBusy(false);
    finish({ ...pending, name, placeId: null, source: "map" });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="La ubicación exacta del recuerdo. No hace falta que sea un lugar del itinerario."
      size="lg"
      footer={
        tab === "map" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmMapPoint()} disabled={!pending} loading={busy}>
              Usar este punto
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <SegmentedControl<Tab>
          value={tab}
          onChange={(next) => {
            setTab(next);
            setError(null);
          }}
          options={[
            { value: "current", label: "📡 Mi ubicación" },
            { value: "search", label: "🔎 Buscar" },
            { value: "map", label: "🗺️ En el mapa" },
          ]}
        />

        {tab === "current" && (
          <div className="space-y-3">
            <p className="text-sm ink-secondary">
              Usa el GPS del dispositivo para guardar el punto exacto donde estás.
            </p>
            <Button onClick={useCurrentLocation} loading={busy}>
              📡 Usar mi ubicación actual
            </Button>
            <p className="text-xs ink-muted">
              El navegador te pedirá permiso. Si lo deniegas, puedes buscar el sitio o marcarlo
              en el mapa.
            </p>
          </div>
        )}

        {tab === "search" && (
          <div className="space-y-3">
            <PlaceSearchInput
              onSelect={(result) => void chooseSearchResult(result)}
              bias={center}
              placeholder="Omoide Yokocho, Ichiran Shibuya…"
              autoFocus
            />
            {busy && (
              <p className="flex items-center gap-2 text-sm ink-muted">
                <Spinner className="h-4 w-4" /> Guardando ubicación…
              </p>
            )}
          </div>
        )}

        {tab === "map" && (
          <div className="space-y-3">
            <p className="text-sm ink-secondary">Pulsa en el mapa para colocar el punto.</p>
            <div className="h-[min(18rem,45dvh)] overflow-hidden rounded-xl border border-subtle">
              <MapCanvas
                markers={
                  pending
                    ? [
                        {
                          id: "pending",
                          latitude: pending.latitude,
                          longitude: pending.longitude,
                          label: "Aquí",
                          active: true,
                        },
                      ]
                    : []
                }
                onMapClick={setPending}
                initialCenter={center}
                autoFit={false}
                showControls
              />
            </div>
            {pending && (
              <p className="text-xs ink-muted">
                {pending.latitude.toFixed(5)}, {pending.longitude.toFixed(5)}
              </p>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
