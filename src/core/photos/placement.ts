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
 * Cuando la foto no trae coordenadas se usa la del usuario **en ese momento**.
 * Es lo que salva el caso normal en Android, donde el selector de fotos borra
 * la ubicacion antes de entregar el archivo: haces la foto, la subes, y donde
 * estas es donde se hizo. Queda apuntado de donde salio cada una, porque no son
 * lo mismo y una ubicacion segura y equivocada es peor que ninguna.
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

/** De donde salieron las coordenadas. `null` si no hay. */
export type CoordsOrigin = "exif" | "current";

export interface PhotoPlacement {
  /** Coordenadas que se guardaran, o `null` si no se puede o no se debe. */
  coords: LatLng | null;
  /** De donde salieron. Se ensena al usuario: no son igual de fiables. */
  from: CoordsOrigin | null;
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
  from: null,
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
  /** Donde esta el usuario ahora. Se usa solo si la foto no trae nada. */
  current?: LatLng | null;
  /** Hoy, en YYYY-MM-DD. Decide si `current` vale: ver la guarda de fechas. */
  today?: string;
}

/** Que hacer con una foto: coordenadas, lugar asignado y lugar propuesto. */
export function placePhoto(input: PlacementInput): PhotoPlacement {
  const elegidas = chooseCoords(input);
  if (!elegidas) {
    // Habia algo que usar y lo ha parado la guarda de fechas: o la foto es de
    // otro dia, o hoy cae fuera del viaje. Se distingue de no tener nada
    // porque no es lo mismo no saber que haber decidido no hacerlo.
    const habia = hasCoords(input) || Boolean(input.current);
    return { ...NADA, reason: habia ? "fuera-del-viaje" : "sin-exif" };
  }

  const { coords, from } = elegidas;
  const cerca = nearest(coords, input.places, SUGGEST_RADIUS_M);

  if (!cerca) {
    return { coords, from, reason: null, placeId: null, suggestedPlaceId: null, meters: null };
  }

  const seguro = cerca.meters <= ASSIGN_RADIUS_M;
  return {
    coords,
    from,
    reason: null,
    placeId: seguro ? cerca.item.id : null,
    suggestedPlaceId: seguro ? null : cerca.item.id,
    meters: cerca.meters,
  };
}

/**
 * Que coordenadas se usan: las de la foto o las de ahora.
 *
 * Las de la foto mandan siempre que existan: dicen donde se hizo, no donde
 * estas tu. La de ahora solo entra cuando la foto no trae nada, que en Android
 * es el caso corriente porque el selector de fotos borra la ubicacion.
 *
 * La guarda de fechas se aplica a las dos, con la fecha que le toca a cada
 * una: la de disparo para el EXIF, hoy para la ubicacion actual. Subir las
 * fotos al volver a casa pondria tu casa en el mapa del viaje.
 */
function chooseCoords(input: PlacementInput): { coords: LatLng; from: CoordsOrigin } | null {
  if (hasCoords(input)) {
    if (!takenDuringTrip(input.takenAt, input.tripStart, input.tripEnd)) return null;
    return {
      coords: { latitude: input.latitude, longitude: input.longitude },
      from: "exif",
    };
  }

  const ahora = input.current;
  if (!ahora) return null;
  if (!takenDuringTrip(input.today ?? null, input.tripStart, input.tripEnd)) return null;

  return { coords: { latitude: ahora.latitude, longitude: ahora.longitude }, from: "current" };
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
