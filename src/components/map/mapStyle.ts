import type { StyleSpecification } from "maplibre-gl";

/**
 * Estilo del mapa.
 *
 * Por defecto se usan teselas raster de CARTO (basemaps de OpenStreetMap),
 * que no requieren API key y encajan con el tema claro/oscuro de la app.
 * En produccion, define NEXT_PUBLIC_MAP_STYLE_URL con un estilo vectorial
 * propio (MapTiler, Stadia, Protomaps...) y este modulo lo respetara.
 */

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';

function rasterStyle(tiles: string[]): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution: OSM_ATTRIBUTION,
        maxzoom: 19,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#e9e6e0" } },
      { id: "basemap", type: "raster", source: "basemap" },
    ],
  };
}

const LIGHT = rasterStyle([
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
]);

const DARK = rasterStyle([
  "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
  "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
  "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
]);

export function mapStyleFor(theme: "light" | "dark"): string | StyleSpecification {
  const custom =
    theme === "dark"
      ? process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK || process.env.NEXT_PUBLIC_MAP_STYLE_URL
      : process.env.NEXT_PUBLIC_MAP_STYLE_URL;

  if (custom) return custom;

  const style = theme === "dark" ? DARK : LIGHT;
  // Copia defensiva: MapLibre muta el objeto de estilo que recibe.
  return JSON.parse(JSON.stringify(style)) as StyleSpecification;
}
