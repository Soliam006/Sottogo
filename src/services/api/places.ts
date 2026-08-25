"use client";

import type { PlaceSearchResult } from "@/core/places/types";

/**
 * Cliente de la busqueda de lugares. La UI nunca conoce el proveedor real:
 * habla con nuestras rutas, que resuelven Photon / Google en el servidor.
 */
export async function searchPlaces(
  query: string,
  options: { bias?: { latitude: number; longitude: number }; signal?: AbortSignal } = {},
): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (options.bias) {
    params.set("lat", String(options.bias.latitude));
    params.set("lng", String(options.bias.longitude));
  }

  const res = await fetch(`/api/places/search?${params.toString()}`, { signal: options.signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "No se ha podido buscar el lugar.");
  }

  const data = (await res.json()) as { results: PlaceSearchResult[] };
  return data.results ?? [];
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<PlaceSearchResult | null> {
  const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
  const res = await fetch(`/api/places/reverse?${params.toString()}`);
  if (!res.ok) return null;

  const data = (await res.json()) as { result: PlaceSearchResult | null };
  return data.result ?? null;
}
