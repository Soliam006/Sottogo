"use client";

import type { TripPlace } from "@/core/models";
import { formatDistance } from "@/core/map/geo";
import { describeLocation } from "@/core/map/location";
import type { PlacedFile } from "@/services/photos/placeFiles";
import { Button, Spinner } from "@/components/ui/Button";
import { PlaceIcon } from "@/components/ui/icons";

/**
 * Que ha averiguado la aplicacion de cada foto antes de subirla.
 *
 * Existe porque colocar las fotos solas no puede ser silencioso: si se acierta,
 * el usuario ve que no tiene que hacer nada; si se falla, lo ve **antes** de
 * subir y no despues, cuando ya hay veinte fotos mal puestas en el mapa.
 *
 * Y se dice de donde salio cada ubicacion. La de la foto es donde se hizo; la
 * del movil es donde estabas al subirla, que casi siempre es lo mismo pero no
 * siempre: subir por la noche en el hotel pondria el hotel. Una ubicacion
 * segura y equivocada es peor que ninguna en una aplicacion que se vende por
 * ensenar donde estas de verdad.
 */
export function PhotoPlacementList({
  files,
  placed,
  tripPlaces,
  locating,
  locationError,
  onAccept,
}: {
  files: readonly File[];
  placed: readonly PlacedFile[];
  tripPlaces: readonly TripPlace[];
  locating: boolean;
  locationError: string | null;
  onAccept: (index: number) => void;
}) {
  const nombreLugar = (id: string | null) =>
    tripPlaces.find((tp) => tp.id === id)?.place.name ?? null;

  if (locating) {
    return (
      <p className="flex items-center gap-2 text-sm ink-muted">
        <Spinner className="h-4 w-4 shrink-0" />
        Mirando dónde se hicieron…
      </p>
    );
  }

  // Sin nada que contar de las fotos, el recuento de siempre. Pasa si leerlas
  // fallo: decir "no llevan ubicacion" seria mentir, no llegamos a mirarlo.
  if (placed.length === 0) {
    return (
      <p className="text-sm ink-muted">
        {files.length} archivo{files.length === 1 ? "" : "s"} seleccionado
        {files.length === 1 ? "" : "s"}.
      </p>
    );
  }

  const ubicadas = placed.filter((p) => p.location);
  // Cuando TODAS vienen de donde estas ahora —el caso normal en Android— se
  // dice una vez arriba en vez de repetirlo en cada linea.
  const todasDeAhora = ubicadas.length > 0 && ubicadas.every((p) => p.from === "current");

  return (
    <div className="space-y-2">
      {todasDeAhora && (
        <p className="rounded-xl surface-2 px-3 py-2 text-xs ink-secondary">
          Estas fotos no traían ubicación, así que se usa <strong>donde estás ahora</strong>.
        </p>
      )}

      {locationError && (
        <p className="rounded-xl surface-2 px-3 py-2 text-xs ink-secondary">
          {locationError} Puedes ponerla a mano abajo.
        </p>
      )}

      <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-subtle">
        {files.map((file, index) => {
          const propio = placed[index];
          const lugar = nombreLugar(propio?.tripPlaceId ?? null);
          const propuesto = nombreLugar(propio?.suggestedTripPlaceId ?? null);
          // Solo se etiqueta si hay mezcla: con todas iguales ya lo dice arriba.
          const origen = !todasDeAhora && propio?.from === "current" ? " · ahora" : "";

          return (
            <li key={`${file.name}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm ink-primary">{file.name}</p>

                {lugar ? (
                  <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs ink-secondary">
                    <PlaceIcon size={12} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
                    <span className="truncate">
                      {lugar}
                      {propio?.location?.name ? ` · ${propio.location.name}` : ""}
                      {origen}
                    </span>
                  </p>
                ) : propuesto ? (
                  <p className="mt-0.5 truncate text-xs ink-secondary">
                    ¿{propuesto}? Está a {formatDistance(propio?.meters ?? 0)}
                  </p>
                ) : propio?.location ? (
                  <p className="mt-0.5 truncate text-xs ink-secondary">
                    {describeLocation(propio.location)}
                    {origen}
                  </p>
                ) : (
                  <p className="mt-0.5 truncate text-xs ink-muted">{sinUbicacion(propio)}</p>
                )}
              </div>

              {propuesto && (
                <Button variant="secondary" size="sm" onClick={() => onAccept(index)}>
                  Asignar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Por que una foto se queda sin ubicacion.
 *
 * Se distingue el caso de la guarda de fechas del de la foto sin datos: son
 * cosas muy distintas y "sin ubicación" a secas haria pensar que la aplicacion
 * no ha sabido, cuando en realidad ha decidido no hacerlo.
 */
function sinUbicacion(propio: PlacedFile | undefined): string {
  if (propio?.reason === "fuera-del-viaje") {
    return "Fuera de las fechas del viaje: no se sitúa sola";
  }
  return "Sin ubicación";
}
