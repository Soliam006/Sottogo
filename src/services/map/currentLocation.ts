"use client";

import { geolocationMessage, type MemoryLocation } from "@/core/map/location";
import { reverseGeocode } from "@/services/api/places";

/**
 * Donde esta el usuario ahora mismo.
 *
 * Estaba metido dentro del selector de ubicacion, colgando del boton "usar mi
 * ubicacion". Sale aqui porque ya no lo pide solo ese boton: al subir fotos se
 * pide **sin que nadie pulse nada**, cuando la foto no trae ubicacion propia.
 *
 * No se pregunta antes de llamar. El navegador ya pregunta una sola vez y se
 * acuerda de la respuesta; anadir nuestro propio "¿me dejas?" delante seria
 * preguntar dos veces por lo mismo. Si esta denegado, esto falla al instante y
 * quien llame se cae al flujo manual.
 */

export interface CurrentLocation {
  location: MemoryLocation | null;
  /** Mensaje ya en cristiano, o `null` si fue bien. */
  error: string | null;
}

const OPCIONES: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  // Vale una lectura de hace un minuto: quien sube varias tandas seguidas no
  // se ha movido, y volver a encender el GPS cada vez cuesta bateria y espera.
  maximumAge: 60_000,
};

export async function currentLocation(): Promise<CurrentLocation> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { location: null, error: "Tu navegador no permite compartir la ubicación." };
  }

  let position: GeolocationPosition;
  try {
    position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, OPCIONES);
    });
  } catch (error) {
    const code = (error as GeolocationPositionError | undefined)?.code;
    return { location: null, error: geolocationMessage(code) };
  }

  const { latitude, longitude } = position.coords;

  // El nombre es un extra: si la geocodificacion falla, las coordenadas siguen
  // valiendo y la foto se coloca igual.
  let name: string | null = null;
  try {
    const found = await reverseGeocode(latitude, longitude);
    name = found?.name ?? null;
  } catch {
    name = null;
  }

  return {
    location: { latitude, longitude, name, placeId: null, source: "current" },
    error: null,
  };
}
