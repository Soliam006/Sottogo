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

/**
 * Coloca sola cada foto que se va a subir: donde se hizo y a que lugar del
 * viaje pertenece.
 *
 * Es el pegamento entre tres piezas que ya existian por separado: el EXIF del
 * archivo, `placePhoto` —que decide con las reglas de radio y de privacidad— y
 * la geocodificacion inversa, que pone nombre al punto.
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

export async function placeFiles(
  files: readonly File[],
  trip: PlacementTrip,
  tripPlaces: readonly TripPlace[],
): Promise<PlacedFile[]> {
  const candidatos = tripPlaces.map((tp) => ({
    id: tp.id,
    latitude: tp.place.latitude,
    longitude: tp.place.longitude,
  }));

  const exifs = await Promise.all(files.map(readExifFromFile));

  const decisiones: PhotoPlacement[] = exifs.map((exif) =>
    placePhoto({
      latitude: exif.latitude,
      longitude: exif.longitude,
      takenAt: exif.takenAt,
      tripStart: trip.startDate,
      tripEnd: trip.endDate,
      places: candidatos,
    }),
  );

  const nombres = await nombresPorGrupo(decisiones.map((d) => d.coords));

  return files.map((file, index) => {
    const decision = decisiones[index];
    const coords = decision.coords;

    return {
      file,
      takenAt: exifs[index].takenAt,
      location: coords
        ? { ...coords, name: nombres[index], placeId: null, source: "exif" }
        : null,
      tripPlaceId: decision.placeId,
      suggestedTripPlaceId: decision.suggestedPlaceId,
      meters: decision.meters,
      reason: decision.reason,
    };
  });
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
