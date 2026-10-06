import type { StyleSpecification } from "maplibre-gl";

/**
 * Estilo del mapa.
 *
 * Por defecto se usan teselas VECTORIALES de OpenFreeMap, que no piden clave ni
 * registro y traen un estilo claro y otro oscuro que encajan con el tema de la
 * aplicacion.
 *
 * Antes se usaba CARTO, tambien sin clave. **Dejo de funcionar sin avisar**: sus
 * basemaps pasaron a exigir API key y empezaron a devolver, con un 200 limpio,
 * una imagen de 2 KB que pone "API KEY REQUIRED" en diagonal. No fallaba nada:
 * el mapa simplemente dejo de existir. Por eso no se vuelve a poner un servicio
 * que pueda cortar el grifo sin que nos enteremos sin dejar antes la salida de
 * abajo preparada.
 *
 * LA SALIDA: `NEXT_PUBLIC_MAP_STYLE_URL` (y su variante `_DARK`) manda sobre
 * todo esto. Si OpenFreeMap se cae o se vuelve de pago, se apunta a MapTiler,
 * Stadia o Protomaps cambiando una variable de entorno, sin tocar codigo.
 */

/**
 * Estilos de OpenFreeMap.
 *
 * `positron` es el gris claro de toda la vida; `dark` es casi negro
 * (rgb(12,12,12)), que es justo el fondo del tema oscuro de la aplicacion.
 *
 * La atribucion viaja dentro del TileJSON del estilo, asi que el control de
 * atribucion que ya monta `MapCanvas` la ensena solo. No hay que repetirla
 * aqui, y tampoco se puede quitar: es la licencia de OpenStreetMap.
 */
const OPENFREEMAP = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export function mapStyleFor(theme: "light" | "dark"): string | StyleSpecification {
  const custom =
    theme === "dark"
      ? process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK || process.env.NEXT_PUBLIC_MAP_STYLE_URL
      : process.env.NEXT_PUBLIC_MAP_STYLE_URL;

  return custom || OPENFREEMAP[theme];
}
