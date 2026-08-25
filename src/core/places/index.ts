export * from "./types";
export * from "./photon";
export * from "./google";

import { GooglePlacesProvider } from "./google";
import { PhotonPlacesProvider } from "./photon";
import type { PlacesProvider } from "./types";

let cached: PlacesProvider | null = null;

/**
 * Factory del proveedor de lugares. SOLO servidor: lee variables sin `NEXT_PUBLIC_`.
 */
export function getPlacesProvider(): PlacesProvider {
  if (cached) return cached;

  const provider = (process.env.PLACES_PROVIDER ?? "photon").toLowerCase();
  cached =
    provider === "google"
      ? new GooglePlacesProvider(process.env.GOOGLE_PLACES_API_KEY ?? "")
      : new PhotonPlacesProvider(process.env.PHOTON_ENDPOINT || undefined);

  return cached;
}
