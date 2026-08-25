import {
  PlacesProvider,
  PlacesProviderError,
  PlaceSearchOptions,
  PlaceSearchResult,
} from "./types";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
  };
}

/**
 * Idiomas que acepta la instancia publica de Photon. Cualquier otro (p. ej. "es")
 * hace que la API responda 400, asi que normalizamos antes de llamar.
 */
const SUPPORTED_LANGS = new Set(["default", "de", "en", "fr"]);
const DEFAULT_LANG = "en";

/** "es-ES" -> "es" -> "en" (fallback). "fr-FR" -> "fr". */
function normalizeLang(lang?: string): string {
  const base = (lang ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGS.has(base) ? base : DEFAULT_LANG;
}

/**
 * Photon (OpenStreetMap). Sin API key y con datos reales.
 * Buen punto de partida; sustituible por Google Places sin tocar la UI.
 */
export class PhotonPlacesProvider implements PlacesProvider {
  readonly id = "photon";

  constructor(private readonly endpoint = "https://photon.komoot.io") {}

  async search({ query, limit = 8, lang, bias }: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      lang: normalizeLang(lang),
    });
    if (bias) {
      params.set("lat", String(bias.latitude));
      params.set("lon", String(bias.longitude));
    }

    const data = await this.request<{ features?: PhotonFeature[] }>(`/api?${params.toString()}`);
    return (data.features ?? []).map(toResult).filter(hasUsableName);
  }

  async reverse(latitude: number, longitude: number, lang?: string): Promise<PlaceSearchResult | null> {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      lang: normalizeLang(lang),
      limit: "1",
    });

    const data = await this.request<{ features?: PhotonFeature[] }>(
      `/reverse?${params.toString()}`,
    );
    const feature = data.features?.[0];
    if (!feature) return null;

    const result = toResult(feature);
    // En reverse el punto exacto pulsado manda sobre el centroide del POI.
    return { ...result, latitude, longitude, externalPlaceId: null };
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.endpoint}${path}`, {
      headers: { "User-Agent": "Voyago/0.1 (trip planner)" },
      next: { revalidate: 60 * 60 },
    });

    if (!res.ok) {
      // El cuerpo de Photon explica el motivo real (idioma no soportado, query invalida...).
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new PlacesProviderError(
        `Photon respondió ${res.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    return (await res.json()) as T;
  }
}

function toResult(feature: PhotonFeature): PlaceSearchResult {
  const p = feature.properties;
  const [longitude, latitude] = feature.geometry.coordinates;

  const streetLine = [p.street, p.housenumber].filter(Boolean).join(" ");
  const address = [streetLine, p.district, p.city ?? p.county, p.state, p.country]
    .filter((part) => Boolean(part && part.trim()))
    .join(", ");

  return {
    provider: "photon",
    externalPlaceId: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : null,
    name: p.name || streetLine || p.city || p.county || p.state || "Lugar sin nombre",
    address: address || null,
    city: p.city ?? p.county ?? p.state ?? null,
    country: p.country ?? null,
    countryCode: p.countrycode ?? null,
    latitude,
    longitude,
    category: p.osm_value ?? p.osm_key ?? null,
    image: null,
  };
}

function hasUsableName(result: PlaceSearchResult): boolean {
  return result.name.trim().length > 0;
}
