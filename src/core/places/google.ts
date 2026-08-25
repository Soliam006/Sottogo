import {
  PlacesProvider,
  PlacesProviderError,
  PlaceSearchOptions,
  PlaceSearchResult,
} from "./types";

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
  photos?: Array<{ name: string }>;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.addressComponents",
  "places.photos",
].join(",");

/**
 * Google Places API (New). Requiere GOOGLE_PLACES_API_KEY en el servidor.
 * Activar en Google Cloud: "Places API (New)" y "Geocoding API".
 */
export class GooglePlacesProvider implements PlacesProvider {
  readonly id = "google";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new PlacesProviderError("Falta GOOGLE_PLACES_API_KEY", 500);
    }
  }

  async search({ query, limit = 8, lang = "es", bias }: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    const body: Record<string, unknown> = {
      textQuery: query,
      maxResultCount: limit,
      languageCode: lang,
    };
    if (bias) {
      body.locationBias = {
        circle: {
          center: { latitude: bias.latitude, longitude: bias.longitude },
          radius: 50000,
        },
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new PlacesProviderError(`Google Places respondió ${res.status}`);
    }

    const data = (await res.json()) as { places?: GooglePlace[] };
    return (data.places ?? []).map((place) => this.toResult(place));
  }

  async reverse(latitude: number, longitude: number, lang = "es"): Promise<PlaceSearchResult | null> {
    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      language: lang,
      key: this.apiKey,
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if (!res.ok) {
      throw new PlacesProviderError(`Google Geocoding respondió ${res.status}`);
    }

    const data = (await res.json()) as {
      results?: Array<{
        place_id: string;
        formatted_address: string;
        address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
      }>;
    };
    const first = data.results?.[0];
    if (!first) return null;

    const component = (type: string) =>
      first.address_components.find((c) => c.types.includes(type));

    return {
      provider: this.id,
      externalPlaceId: null,
      name: first.formatted_address.split(",")[0] ?? "Ubicación",
      address: first.formatted_address,
      city:
        component("locality")?.long_name ??
        component("administrative_area_level_1")?.long_name ??
        null,
      country: component("country")?.long_name ?? null,
      countryCode: component("country")?.short_name ?? null,
      latitude,
      longitude,
      category: null,
      image: null,
    };
  }

  private toResult(place: GooglePlace): PlaceSearchResult {
    const component = (type: string) =>
      place.addressComponents?.find((c) => c.types.includes(type));

    const photoName = place.photos?.[0]?.name;

    return {
      provider: this.id,
      externalPlaceId: place.id,
      name: place.displayName?.text ?? "Lugar sin nombre",
      address: place.formattedAddress ?? null,
      city:
        component("locality")?.longText ??
        component("administrative_area_level_1")?.longText ??
        null,
      country: component("country")?.longText ?? null,
      countryCode: component("country")?.shortText ?? null,
      latitude: place.location?.latitude ?? 0,
      longitude: place.location?.longitude ?? 0,
      category: place.types?.[0] ?? null,
      image: photoName
        ? `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=480&key=${this.apiKey}`
        : null,
    };
  }
}
