/**
 * Abstraccion de busqueda de lugares reales.
 *
 * La UI nunca habla con Google/Photon/Mapbox directamente: consume
 * `/api/places/*`, que resuelve el proveedor configurado. Cambiar de
 * proveedor = implementar `PlacesProvider` y registrarlo en el factory.
 * Las API keys viven solo en el servidor.
 */

export interface PlaceSearchResult {
  /** Id estable del proveedor. Permite deduplicar lugares entre viajes. */
  externalPlaceId: string | null;
  provider: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  image: string | null;
}

export interface PlaceSearchOptions {
  query: string;
  limit?: number;
  lang?: string;
  /** Sesga los resultados hacia estas coordenadas (centro del viaje). */
  bias?: { latitude: number; longitude: number };
}

export interface PlacesProvider {
  readonly id: string;
  search(options: PlaceSearchOptions): Promise<PlaceSearchResult[]>;
  reverse(latitude: number, longitude: number, lang?: string): Promise<PlaceSearchResult | null>;
}

export class PlacesProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}
