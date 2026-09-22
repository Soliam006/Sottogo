/**
 * Donde va una foto: sus coordenadas y a que lugar del viaje pertenece.
 *
 * Hasta ahora las dos cosas las ponia el usuario a mano, foto a foto. Esto
 * decide por el a partir del EXIF, con dos reglas que no son un detalle:
 *
 *   - **Cerca se asigna, lejos solo se propone.** El radio que ya usaba la
 *     interfaz para sugerir, 1500 m, es demasiado para asignar solo: en Tokio
 *     cruza de Shibuya a Harajuku. Por debajo de 400 m no hay duda razonable;
 *     entre 400 y 1500 la hay, y decide el usuario.
 *   - **Fuera de las fechas del viaje no se geoetiqueta.** Una foto hecha en
 *     casa la semana anterior subiria con las coordenadas de casa, a la vista
 *     de todo el viaje. Nadie ha pedido eso al subir fotos de Japon.
 *
 * Capa pura: sin React, sin red, sin Supabase.
 */

import type { UUID } from "@/core/models";
import { distanceMeters, hasCoords, nearest, type LatLng } from "@/core/map/geo";

/** Por debajo de esto, la foto se asigna sola al lugar. */
export const ASSIGN_RADIUS_M = 400;
/** Entre `ASSIGN_RADIUS_M` y esto, se propone y decide el usuario. */
export const SUGGEST_RADIUS_M = 1_500;

export interface PlaceCandidate extends LatLng {
  id: UUID;
}

/** Por que la foto acabo sin coordenadas. Se ensena al usuario. */
export type NoCoordsReason =
  | "sin-exif"
  /** Tiene coordenadas, pero la foto es de antes o despues del viaje. */
  | "fuera-del-viaje";

export interface PhotoPlacement {
  /** Coordenadas que se guardaran, o `null` si no se puede o no se debe. */
  coords: LatLng | null;
  reason: NoCoordsReason | null;
  /** Lugar del viaje elegido solo, listo para guardar. */
  placeId: UUID | null;
  /** Lugar del viaje propuesto: hay que confirmarlo. */
  suggestedPlaceId: UUID | null;
  /** Distancia al lugar elegido o propuesto, para poder ensenarla. */
  meters: number | null;
}

const NADA: PhotoPlacement = {
  coords: null,
  reason: "sin-exif",
  placeId: null,
  suggestedPlaceId: null,
  meters: null,
};

export interface PlacementInput {
  latitude: number | null;
  longitude: number | null;
  /** Instante ISO de disparo, si se conoce. */
  takenAt: string | null;
  tripStart: string;
  tripEnd: string;
  places: readonly PlaceCandidate[];
}

/** Que hacer con una foto: coordenadas, lugar asignado y lugar propuesto. */
export function placePhoto(input: PlacementInput): PhotoPlacement {
  if (!hasCoords(input)) return NADA;

  if (!takenDuringTrip(input.takenAt, input.tripStart, input.tripEnd)) {
    return { ...NADA, reason: "fuera-del-viaje" };
  }

  const coords: LatLng = { latitude: input.latitude, longitude: input.longitude };
  const cerca = nearest(coords, input.places, SUGGEST_RADIUS_M);

  if (!cerca) {
    return { coords, reason: null, placeId: null, suggestedPlaceId: null, meters: null };
  }

  const seguro = cerca.meters <= ASSIGN_RADIUS_M;
  return {
    coords,
    reason: null,
    placeId: seguro ? cerca.item.id : null,
    suggestedPlaceId: seguro ? null : cerca.item.id,
    meters: cerca.meters,
  };
}

/**
 * Si la foto cae dentro de las fechas del viaje.
 *
 * Sin fecha se da por buena: una foto con coordenadas y sin `DateTimeOriginal`
 * casi siempre viene de una camara, y negarle la ubicacion por no saber cuando
 * se hizo dejaria fuera el caso que mas vale la pena.
 *
 * La comparacion es por dia natural y no por instante: `takenAt` lleva la hora
 * LOCAL de donde se disparo, y las fechas del viaje son dias sueltos sin hora.
 * Mezclar husos aqui haria saltar de dia a las fotos de la primera y la ultima
 * noche, que son justo las que mas se suben.
 */
export function takenDuringTrip(
  takenAt: string | null,
  tripStart: string,
  tripEnd: string,
): boolean {
  if (!takenAt) return true;
  if (!tripStart || !tripEnd) return true;

  const dia = takenAt.slice(0, 10);
  return dia >= tripStart && dia <= tripEnd;
}

/**
 * Agrupa coordenadas que estan practicamente en el mismo sitio.
 *
 * Subir veinte fotos serian veinte geocodificaciones inversas contra Photon o
 * Google: veinte peticiones para veinte respuestas casi iguales, porque quien
 * hace veinte fotos seguidas las hace en dos o tres sitios. Esto devuelve, por
 * cada foto, el indice de la primera que estaba a menos de `meters`, y quien
 * llame solo pregunta una vez por grupo.
 */
export function clusterCoords(
  points: readonly (LatLng | null)[],
  meters = 60,
): (number | null)[] {
  const lideres: { index: number; point: LatLng }[] = [];

  return points.map((point, index) => {
    if (!point) return null;

    const lider = lideres.find((l) => distanceMeters(point, l.point) <= meters);
    if (lider) return lider.index;

    lideres.push({ index, point });
    return index;
  });
}
