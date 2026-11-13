import type { Map as MapLibreMap, SymbolLayerSpecification } from "maplibre-gl";

/**
 * Los sitios del mapa: comercios, hoteles, museos, estaciones.
 *
 * Las teselas YA los traen —la capa `poi` del origen `openmaptiles` viene
 * desde el zoom 11—, pero el estilo oscuro de OpenFreeMap no dibuja ninguno:
 * tiene cero capas de POI contra las cuatro de `bright`. No falta informacion,
 * faltaba pintarla.
 *
 * Por eso esto existe en vez de cambiar de estilo y ya: no hay ningun estilo
 * OSCURO con sitios. `bright` y `liberty` los traen pero son claros, y los dos
 * oscuros —`dark` y `fiord`— no traen ninguno. Asi que al oscuro se le anaden
 * aqui, copiando los filtros de `bright` y recoloreando.
 *
 * Funciona porque los cuatro estilos comparten el MISMO sprite
 * (`ofm_f384/ofm`, 264 iconos): el mapa oscuro ya se estaba descargando los
 * iconos de restaurante, hotel y atraccion sin usarlos.
 */

/** Como se eligen el icono y el nombre. Identico en las tres capas de rango. */
const ICONO = [
  "match",
  ["get", "subclass"],
  ["florist", "furniture"],
  ["get", "subclass"],
  ["get", "class"],
] as unknown as SymbolLayerSpecification["layout"];

/**
 * El nombre local y el internacional, uno debajo del otro.
 *
 * Importa para un diario de viajes: en Japon el rotulo de la calle esta en
 * japones, y ensenar solo la transcripcion deja al viajero sin poder comparar
 * lo que ve con lo que pone el mapa.
 */
const NOMBRE = [
  "case",
  ["has", "name:nonlatin"],
  ["concat", ["get", "name:latin"], "\n", ["get", "name:nonlatin"]],
  ["coalesce", ["get", "name_en"], ["get", "name"]],
];

interface Paleta {
  texto: string;
  halo: string;
  transporte: string;
  /** Relleno de los edificios, o `null` para no tocarlo. */
  edificios: string | null;
}

/**
 * En oscuro los edificios venian en rgb(10,10,10) sobre un fondo rgb(12,12,12):
 * dibujados, pero invisibles a proposito. Se suben lo justo para que se
 * distingan las manzanas sin competir con los marcadores.
 */
const PALETAS: Record<"light" | "dark", Paleta> = {
  light: { texto: "#666666", halo: "#ffffff", transporte: "#2e5a80", edificios: null },
  dark: { texto: "#9aa4b2", halo: "rgba(0,0,0,0.85)", transporte: "#7fa8d4", edificios: "rgb(26,26,29)" },
};

/**
 * Desde donde se ensenan estaciones y paradas.
 *
 * `bright` trae esta capa SIN umbral, y eso a la altura de un barrio llena el
 * mapa de paradas de autobus: cientos de iconos azules que tapan los sitios
 * que de verdad orientan. Una parada solo sirve cuando ya estas en la calle.
 */
const TRANSPORTE_MINZOOM = 15;

/**
 * Rangos de importancia. Cuanto mas abajo, mas hay que acercarse para verlo.
 *
 * Son los mismos umbrales que trae `bright`. Probe a bajarlos un zoom para que
 * los sitios salieran antes y quedo peor: a 14 el mapa se llena de cruces de
 * farmacia y centros de salud, y los sitios que de verdad orientan se pierden
 * entre ellos. El rango no mide lo conocido que es un sitio, solo su
 * categoria, asi que adelantarlo no trae antes la Sagrada Familia: lo trae
 * antes TODO.
 */
const RANGOS = [
  { id: "poi_r1", minzoom: 15, desde: 1, hasta: 7 },
  { id: "poi_r7", minzoom: 16, desde: 7, hasta: 20 },
  { id: "poi_r20", minzoom: 17, desde: 20, hasta: null },
];

/**
 * Anade las capas de sitios si el estilo no las trae.
 *
 * Es idempotente a proposito: `bright` ya las tiene con estos mismos
 * identificadores, asi que en el tema claro no hace nada. Y se vuelve a llamar
 * tras cada `setStyle`, porque cambiar de tema se lleva por delante todo lo
 * que no venga en el estilo.
 */
export function addPlaceLayers(map: MapLibreMap, theme: "light" | "dark"): void {
  // Sin el origen de datos no hay nada que dibujar: pasa mientras el estilo
  // aun se esta cargando, y tambien si alguien apunta a un estilo propio con
  // `NEXT_PUBLIC_MAP_STYLE_URL` que no sea de OpenMapTiles.
  if (!map.getSource("openmaptiles")) return;

  const paleta = PALETAS[theme];

  if (paleta.edificios && map.getLayer("building")) {
    map.setPaintProperty("building", "fill-color", paleta.edificios);
  }

  for (const rango of RANGOS) {
    // `bright` ya las trae, y con estos mismos umbrales: ahi no hay nada que
    // hacer. Solo se crean para el tema oscuro, que no tiene ninguna.
    if (map.getLayer(rango.id)) continue;

    const filtro: unknown[] = [
      "all",
      ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
      [">=", ["get", "rank"], rango.desde],
    ];
    if (rango.hasta !== null) filtro.push(["<", ["get", "rank"], rango.hasta]);

    map.addLayer({
      id: rango.id,
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: rango.minzoom,
      filter: filtro,
      layout: {
        "icon-image": ICONO,
        "text-field": NOMBRE,
        "text-font": ["Noto Sans Italic"],
        "text-anchor": "top",
        "text-offset": [0, 0.6],
        "text-max-width": 9,
        "text-size": 12,
      },
      paint: {
        "text-color": paleta.texto,
        "text-halo-color": paleta.halo,
        "text-halo-width": 1,
        "text-halo-blur": 0.5,
      },
    } as never);
  }

  // El transporte va aparte porque `bright` lo trae SIN umbral de zoom, y eso
  // a la altura de un barrio llena el mapa de paradas de autobus: cientos de
  // iconos azules que tapan los sitios que de verdad orientan. Una parada solo
  // sirve cuando ya estas en la calle.
  if (map.getLayer("poi_transit")) {
    map.setLayerZoomRange("poi_transit", TRANSPORTE_MINZOOM, 24);
  } else {
    map.addLayer({
      id: "poi_transit",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: TRANSPORTE_MINZOOM,
      // El sprite no trae icono de `rail`; el rotulo se dibuja igual.
      filter: ["match", ["get", "class"], ["airport", "bus", "rail"], true, false],
      layout: {
        "icon-image": ["to-string", ["get", "class"]],
        "icon-size": 0.7,
        "text-field": NOMBRE,
        "text-font": ["Noto Sans Italic"],
        "text-anchor": "left",
        "text-offset": [0.9, 0],
        "text-max-width": 9,
        "text-size": 12,
      },
      paint: {
        "text-color": paleta.transporte,
        "text-halo-color": paleta.halo,
        "text-halo-width": 1,
        "text-halo-blur": 0.5,
      },
    } as never);
  }
}
