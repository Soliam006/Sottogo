"use client";

import type { TripPlace, UUID } from "@/core/models";
import type { MemoryLocation } from "@/core/map/location";
import { readExif } from "@/core/exif";
import {
  clusterCoords,
  placePhoto,
  type NoCoordsReason,
  type PhotoPlacement,
} from "@/core/photos/placement";
import { reverseGeocode } from "@/services/api/places";
import { currentLocation } from "@/services/map/currentLocation";
import { todayISO } from "@/lib/format";

/**
 * Coloca sola cada foto que se va a subir: donde se hizo y a que lugar del
 * viaje pertenece.
 *
 * Es el pegamento entre cuatro piezas: el EXIF del archivo, la ubicacion del
 * usuario ahora mismo, `placePhoto` —que decide con las reglas de radio y de
 * privacidad— y la geocodificacion inversa, que pone nombre al punto.
 *
 * La ubicacion de ahora solo se pide **si alguna foto la necesita**. En Android
 * la necesitan casi todas, porque el selector de fotos borra el GPS antes de
 * entregar el archivo; en un iPhone o entrando por el explorador, ninguna, y
 * entonces no se molesta al usuario con el permiso.
 *
 * Nada de esto puede impedir subir una foto. Si el EXIF no esta, si la red
 * falla o si el proveedor de lugares no contesta, la foto sube igual y el
 * usuario rellena lo que quiera a mano, como hasta ahora.
 */

/**
 * Cuanto se lee de cada archivo para buscar el EXIF.
 *
 * El bloque va al principio y un APP1 no puede pasar de 64 KB, asi que con
 * esto sobra. Leer el archivo entero serian 4 MB por foto en memoria, y en un
 * lote de veinte eso es un movil de gama media muerto.
 */
const CABECERA_BYTES = 256 * 1024;

export interface PlacedFile {
  file: File;
  /** Fecha real de disparo. Mejor que `lastModified`, que es cuando se copio. */
  takenAt: string | null;
  /** De donde salio la ubicacion: de la foto, o de donde estabas al subirla. */
  from: "exif" | "current" | null;
  /** Ubicacion exacta lista para guardar, con nombre si se pudo averiguar. */
  location: MemoryLocation | null;
  /** Lugar del viaje asignado solo: estaba lo bastante cerca. */
  tripPlaceId: UUID | null;
  /** Lugar del viaje propuesto: hay que confirmarlo. */
  suggestedTripPlaceId: UUID | null;
  /** Distancia al lugar asignado o propuesto. */
  meters: number | null;
  /** Por que no hay ubicacion, si no la hay. */
  reason: NoCoordsReason | null;
}

export interface PlacementTrip {
  startDate: string;
  endDate: string;
}

export interface PlaceFilesResult {
  placed: PlacedFile[];
  /** Por que no se pudo usar la ubicacion de ahora, si hizo falta y fallo. */
  locationError: string | null;
}

export async function placeFiles(
  files: readonly File[],
  trip: PlacementTrip,
  tripPlaces: readonly TripPlace[],
): Promise<PlaceFilesResult> {
  const candidatos = tripPlaces.map((tp) => ({
    id: tp.id,
    latitude: tp.place.latitude,
    longitude: tp.place.longitude,
  }));

  const exifs = await Promise.all(files.map(readExifFromFile));

  // Solo se pide la ubicacion si alguna foto se va a quedar sin ella. Con
  // fotos que ya traen GPS no hay motivo para encender nada.
  const algunaSinGps = exifs.some(
    (exif) => exif.latitude === null || exif.longitude === null,
  );
  const ahora = algunaSinGps ? await currentLocation() : { location: null, error: null };
  const hoy = todayISO();

  const decisiones: PhotoPlacement[] = exifs.map((exif) =>
    placePhoto({
      latitude: exif.latitude,
      longitude: exif.longitude,
      takenAt: exif.takenAt,
      tripStart: trip.startDate,
      tripEnd: trip.endDate,
      places: candidatos,
      current: ahora.location,
      today: hoy,
    }),
  );

  // La ubicacion de ahora ya trae su nombre resuelto: no se vuelve a preguntar
  // por ella. Solo se geocodifican las que salieron del EXIF.
  const nombres = await nombresPorGrupo(
    decisiones.map((d) => (d.from === "exif" ? d.coords : null)),
  );

  const placed = files.map((file, index) => {
    const decision = decisiones[index];
    const coords = decision.coords;

    return {
      file,
      takenAt: exifs[index].takenAt,
      from: decision.from,
      location: coords
        ? {
            ...coords,
            name: decision.from === "current" ? ahora.location?.name ?? null : nombres[index],
            placeId: null,
            source: decision.from === "current" ? ("current" as const) : ("exif" as const),
          }
        : null,
      tripPlaceId: decision.placeId,
      suggestedTripPlaceId: decision.suggestedPlaceId,
      meters: decision.meters,
      reason: decision.reason,
    };
  });

  return { placed, locationError: algunaSinGps ? ahora.error : null };
}

/** El EXIF de un archivo, leyendo solo su cabecera. */
async function readExifFromFile(file: File) {
  try {
    const head = await file.slice(0, CABECERA_BYTES).arrayBuffer();
    return readExif(head);
  } catch {
    return { latitude: null, longitude: null, takenAt: null };
  }
}

/**
 * Un nombre por foto, preguntando una sola vez por grupo de fotos cercanas.
 *
 * Veinte fotos seguidas se hacen en dos o tres sitios: preguntar veinte veces
 * seria castigar a Photon —que es publico y tiene limites— para recibir veinte
 * respuestas iguales.
 */
async function nombresPorGrupo(
  coords: readonly ({ latitude: number; longitude: number } | null)[],
): Promise<(string | null)[]> {
  const grupos = clusterCoords(coords);
  const lideres = [...new Set(grupos.filter((g): g is number => g !== null))];

  const resueltos = new Map<number, string | null>();
  await Promise.all(
    lideres.map(async (index) => {
      const punto = coords[index];
      if (!punto) return;
      try {
        const encontrado = await reverseGeocode(punto.latitude, punto.longitude);
        resueltos.set(index, encontrado?.name ?? null);
      } catch {
        // El nombre es un extra: sin el, las coordenadas siguen valiendo.
        resueltos.set(index, null);
      }
    }),
  );

  return grupos.map((grupo) => (grupo === null ? null : resueltos.get(grupo) ?? null));
}
