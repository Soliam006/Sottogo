"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, {
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type Marker as MapLibreMarker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/cn";
import { useTheme } from "@/components/providers/ThemeProvider";
import { mapStyleFor } from "./mapStyle";
import { glyphSvg, type MarkerGlyph } from "./markerGlyphs";

export interface MapMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  sublabel?: string | null;
  imageUrl?: string | null;
  /** Icono a mostrar cuando no hay miniatura. */
  badge?: MarkerGlyph | null;
  /** Resumen de contenido del lugar: icono + numero, en el mapa global. */
  stats?: { glyph: MarkerGlyph; count: number }[];
  /** Numero de elementos agrupados en este marcador (clustering). */
  count?: number | null;
  /** Marcador redondo con miniatura grande, para el mapa de recuerdos. */
  variant?: "pill" | "memory";
  /** Resalta el marcador (p. ej. el seleccionado). */
  active?: boolean;
}

export interface MapCanvasProps {
  markers: MapMarkerData[];
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (coords: { latitude: number; longitude: number }) => void;
  initialCenter?: { latitude: number; longitude: number } | null;
  initialZoom?: number;
  /** Encaja la vista a los marcadores. */
  autoFit?: boolean;
  /**
   * Firma que dispara el reencaje. Debe ser ESTABLE frente al zoom: si se
   * reencajara cada vez que cambian los marcadores, el agrupamiento por zoom
   * provocaria un bucle (encajar -> cambia el zoom -> reagrupar -> encajar).
   */
  autoFitKey?: string;
  /** Zoom maximo al encajar. El mapa de recuerdos necesita acercarse mas. */
  fitMaxZoom?: number;
  /** Padding del encaje, para dejar hueco a las tarjetas flotantes. */
  fitPadding?: number;
  /** Notifica el zoom actual: el clustering depende de el. */
  onZoomChange?: (zoom: number) => void;
  showControls?: boolean;
  className?: string;
}

/**
 * Envoltura de MapLibre GL. Concentra todo el ciclo de vida imperativo del
 * mapa para que el resto de la app trabaje solo con datos.
 */
export function MapCanvas({
  markers,
  selectedId = null,
  onMarkerClick,
  onMapClick,
  initialCenter,
  initialZoom = 11,
  autoFit = true,
  autoFitKey,
  fitMaxZoom = 14,
  fitPadding = 72,
  onZoomChange,
  showControls = true,
  className,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Map<string, MapLibreMarker>>(new Map());
  const [ready, setReady] = useState(false);
  const { resolved } = useTheme();

  const clickHandler = useRef(onMapClick);
  clickHandler.current = onMapClick;
  const markerHandler = useRef(onMarkerClick);
  markerHandler.current = onMarkerClick;
  const zoomHandler = useRef(onZoomChange);
  zoomHandler.current = onZoomChange;
  // El encaje lee los marcadores por referencia para no depender de su
  // identidad: la dependencia real es `autoFitKey`.
  const markersRef = useRef(markers);
  markersRef.current = markers;

  // --- Creacion del mapa ----------------------------------------------------
  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: mapStyleFor(resolved),
      center: [initialCenter?.longitude ?? 2.17, initialCenter?.latitude ?? 41.38],
      zoom: initialCenter ? initialZoom : 2.2,
      attributionControl: { compact: true },
    });

    if (showControls) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(
        new maplibregl.GeolocateControl({ trackUserLocation: false, showAccuracyCircle: false }),
        "top-right",
      );
    }

    map.on("click", (event) => {
      clickHandler.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    });
    map.on("load", () => {
      setReady(true);
      zoomHandler.current?.(map.getZoom());
    });
    // `zoomend` y no `zoom`: reagrupar en cada frame de la animacion seria
    // recrear todos los marcadores decenas de veces por segundo.
    map.on("zoomend", () => zoomHandler.current?.(map.getZoom()));

    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Solo al montar: el estilo se actualiza en el efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Cambio de tema -------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    mapRef.current.setStyle(mapStyleFor(resolved));
  }, [resolved, ready]);

  // --- Sincronizacion de marcadores ----------------------------------------
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();

    for (const data of markers) {
      if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) continue;
      seen.add(data.id);

      // Recrear es mas seguro que mutar: MapLibre guarda una referencia interna
      // al elemento del marcador.
      markerRefs.current.get(data.id)?.remove();

      const element = buildMarkerElement(data, data.id === selectedId);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        markerHandler.current?.(data.id);
      });

      const marker = new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([data.longitude, data.latitude])
        .addTo(map);

      markerRefs.current.set(data.id, marker);
    }

    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers, selectedId]);

  useEffect(() => {
    if (ready) syncMarkers();
  }, [ready, syncMarkers]);

  // --- Encaje automatico ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !autoFit) return;

    const located = markersRef.current.filter(
      (m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude),
    );
    if (!located.length) return;

    if (located.length === 1) {
      map.easeTo({
        center: [located[0].longitude, located[0].latitude],
        zoom: Math.max(13, Math.min(fitMaxZoom, 16)),
        duration: 700,
      });
      return;
    }

    const bounds = located.reduce(
      (acc, m) => acc.extend([m.longitude, m.latitude]),
      new maplibregl.LngLatBounds(
        [located[0].longitude, located[0].latitude],
        [located[0].longitude, located[0].latitude],
      ),
    );
    map.fitBounds(bounds as LngLatBoundsLike, {
      padding: fitPadding,
      maxZoom: fitMaxZoom,
      duration: 800,
    });
  }, [ready, autoFit, autoFitKey, fitMaxZoom, fitPadding]);

  // --- Centrar en el seleccionado -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;
    const target = markers.find((m) => m.id === selectedId);
    if (target) {
      map.easeTo({
        center: [target.longitude, target.latitude],
        zoom: Math.max(map.getZoom(), 13),
        duration: 600,
      });
    }
  }, [selectedId, markers, ready]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <div ref={container} className="h-full w-full" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center surface-2">
          <span className="text-sm ink-muted">Cargando mapa…</span>
        </div>
      )}
    </div>
  );
}

function buildMarkerElement(data: MapMarkerData, active: boolean): HTMLElement {
  return data.variant === "memory"
    ? buildMemoryMarker(data, active)
    : buildPillMarker(data, active);
}

/**
 * Marcador del mapa de RECUERDOS: la miniatura de la foto manda sobre el pin.
 * Si agrupa varios recuerdos, lleva un contador en la esquina.
 */
function buildMemoryMarker(data: MapMarkerData, active: boolean): HTMLElement {
  const root = document.createElement("button");
  root.type = "button";
  root.setAttribute("aria-label", data.count && data.count > 1 ? `${data.label} (${data.count})` : data.label);
  root.className = [
    "voyago-marker voyago-memory relative block h-14 w-14 overflow-visible rounded-2xl border-2 shadow-lg",
    "transition-transform duration-150 hover:scale-[1.08]",
    active
      ? "border-[var(--color-brand-600)] scale-[1.1]"
      : "border-[var(--surface-1)]",
  ].join(" ");

  const frame = document.createElement("span");
  frame.className =
    "flex h-full w-full items-center justify-center overflow-hidden rounded-[0.7rem] bg-[var(--surface-2)] text-xl";

  if (data.imageUrl) {
    const img = document.createElement("img");
    img.src = data.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.className = "h-full w-full object-cover";
    frame.appendChild(img);
  } else {
    frame.innerHTML = glyphSvg(data.badge ?? "moment", 24);
  }
  root.appendChild(frame);

  if (data.count && data.count > 1) {
    const count = document.createElement("span");
    count.className = [
      "absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full",
      "bg-[var(--color-brand-600)] px-1.5 text-[11px] font-bold text-white shadow",
    ].join(" ");
    count.textContent = String(data.count);
    root.appendChild(count);
  }

  return root;
}

/** Marcador del mapa GLOBAL: tarjeta compacta con miniatura y resumen. */
function buildPillMarker(data: MapMarkerData, active: boolean): HTMLElement {
  const root = document.createElement("button");
  root.type = "button";
  root.setAttribute("aria-label", data.label);
  root.className = [
    "voyago-marker group flex max-w-[190px] items-center gap-2 rounded-full border px-1.5 py-1.5 pr-3",
    "shadow-lg backdrop-blur transition-transform duration-150 hover:scale-[1.04]",
    active
      ? "border-transparent bg-[var(--color-brand-600)] text-white scale-[1.06]"
      : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-primary)]",
  ].join(" ");

  const thumb = document.createElement("span");
  thumb.className =
    "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-2)] text-sm";

  if (data.imageUrl) {
    const img = document.createElement("img");
    img.src = data.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.className = "h-full w-full object-cover";
    thumb.appendChild(img);
  } else {
    thumb.innerHTML = glyphSvg(data.badge ?? "place", 18);
  }

  const text = document.createElement("span");
  text.className = "min-w-0 text-left leading-tight";

  const title = document.createElement("span");
  title.className = "block truncate text-xs font-semibold";
  title.textContent = data.label;
  text.appendChild(title);

  if (data.stats?.length) {
    const sub = document.createElement("span");
    sub.className = "mt-0.5 flex items-center gap-2 text-[10px] opacity-80";
    sub.innerHTML = data.stats
      .map(
        (stat) =>
          `<span class="inline-flex items-center gap-0.5">${glyphSvg(stat.glyph, 11)}${stat.count}</span>`,
      )
      .join("");
    text.appendChild(sub);
  } else if (data.sublabel) {
    const sub = document.createElement("span");
    sub.className = "block truncate text-[10px] opacity-70";
    sub.textContent = data.sublabel;
    text.appendChild(sub);
  }

  root.append(thumb, text);
  return root;
}
