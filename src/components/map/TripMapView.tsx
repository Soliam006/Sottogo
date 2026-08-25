"use client";

import { useCallback, useMemo, useState } from "react";
import type { Moment, Photo, PublicProfile, TripMember, TripPlace } from "@/core/models";
import { baseAmount } from "@/core/expenses/balance";
import {
  clusterMemories,
  collectForPlace,
  contentSummary,
  hasContent,
  type ContentStat,
  type MemoryCluster,
  type PlaceContent,
  type PlaceContentCounts,
} from "@/core/map/memories";
import { formatDate, formatMoney } from "@/lib/format";
import { useTrip } from "@/components/providers/TripProvider";
import { useExpenses, useMoments, usePhotos } from "@/hooks/useTripCollections";
import { Avatar } from "@/components/ui/Avatar";
import { BackIcon, MomentIcon, PlaceIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Rating, SegmentedControl } from "@/components/ui/Misc";
import { PhotoLightbox } from "@/components/photos/PhotoLightbox";
import { PlacePicker } from "@/components/places/PlacePicker";
import { MapCanvas, type MapMarkerData } from "./MapCanvas";
import type { MarkerGlyph } from "./markerGlyphs";

/** Filtro del mapa global. Conserva el conmutador que ya existia. */
type Mode = "places" | "photos";

/**
 * El mapa es jerarquico:
 *
 *   global    -> los lugares del itinerario (TripPlace) con su contenido.
 *   memories  -> al pulsar uno, los demas desaparecen y aparecen las
 *                ubicaciones EXACTAS de sus fotos y momentos.
 */
type View = { level: "global" } | { level: "memories"; tripPlaceId: string };

const EMPTY_CONTENT: PlaceContent = { photos: [], moments: [], located: [], unlocated: 0 };

/** Tipo de contenido -> icono del marcador. */
const STAT_GLYPH = {
  photos: "photo",
  moments: "moment",
  expenses: "expense",
} as const satisfies Record<ContentStat["kind"], MarkerGlyph>;

/**
 * Vista principal del mapa: el mapa ocupa la pantalla y las tarjetas flotan
 * encima. De mapa de marcadores a forma de explorar los recuerdos del viaje.
 */
export function TripMapView() {
  const { trip, tripPlaces, members, center } = useTrip();
  const tripId = trip?.id ?? "";

  const { data: photos } = usePhotos(tripId);
  const { data: moments } = useMoments(tripId);
  const { data: expenses } = useExpenses(tripId);

  const [mode, setMode] = useState<Mode>("places");
  const [view, setView] = useState<View>({ level: "global" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(11);
  const [adding, setAdding] = useState(false);
  const [lightbox, setLightbox] = useState<{ photo: Photo; photos: Photo[] } | null>(null);

  // --- Contenido por lugar: una sola pasada para contar y para explorar -----
  const contentByPlace = useMemo(() => {
    const map = new Map<string, PlaceContent>();
    for (const tp of tripPlaces) {
      map.set(tp.id, collectForPlace(tp, photos ?? [], moments ?? []));
    }
    return map;
  }, [tripPlaces, photos, moments]);

  const expenseStats = useMemo(() => {
    const count = new Map<string, number>();
    const total = new Map<string, number>();
    for (const expense of expenses ?? []) {
      if (!expense.tripPlaceId) continue;
      count.set(expense.tripPlaceId, (count.get(expense.tripPlaceId) ?? 0) + 1);
      total.set(expense.tripPlaceId, (total.get(expense.tripPlaceId) ?? 0) + baseAmount(expense));
    }
    return { count, total };
  }, [expenses]);

  const countsFor = useCallback(
    (tripPlaceId: string): PlaceContentCounts => {
      const content = contentByPlace.get(tripPlaceId);
      return {
        photos: content?.photos.length ?? 0,
        moments: content?.moments.length ?? 0,
        expenses: expenseStats.count.get(tripPlaceId) ?? 0,
      };
    },
    [contentByPlace, expenseStats],
  );

  const placesWithContent = useMemo(
    () => tripPlaces.filter((tp) => hasContent(countsFor(tp.id))),
    [tripPlaces, countsFor],
  );

  // --- Nivel 1: mapa global -------------------------------------------------
  const visiblePlaces = mode === "photos" ? placesWithContent : tripPlaces;

  const globalMarkers = useMemo<MapMarkerData[]>(
    () =>
      visiblePlaces.map((tp) => {
        const content = contentByPlace.get(tp.id);
        return {
          id: tp.id,
          latitude: tp.place.latitude,
          longitude: tp.place.longitude,
          label: tp.place.name,
          // Icono + numero por tipo de contenido; si no hay nada, la ciudad.
          stats: contentSummary(countsFor(tp.id)).map((stat) => ({
            glyph: STAT_GLYPH[stat.kind],
            count: stat.count,
          })),
          sublabel: tp.place.city,
          imageUrl: content?.photos[0]?.thumbUrl ?? null,
          badge: tp.status === "visited" ? "visited" : "place",
          variant: "pill",
          active: tp.id === selectedId,
        };
      }),
    [visiblePlaces, contentByPlace, countsFor, selectedId],
  );

  // --- Nivel 2: mapa de recuerdos ------------------------------------------
  const activePlace =
    view.level === "memories"
      ? (tripPlaces.find((tp) => tp.id === view.tripPlaceId) ?? null)
      : null;
  const activeContent = activePlace
    ? (contentByPlace.get(activePlace.id) ?? EMPTY_CONTENT)
    : EMPTY_CONTENT;

  const clusters = useMemo<MemoryCluster[]>(
    () => (activePlace ? clusterMemories(activeContent.located, zoom) : []),
    [activePlace, activeContent, zoom],
  );

  const memoryMarkers = useMemo<MapMarkerData[]>(
    () =>
      clusters.map((cluster) => ({
        id: cluster.id,
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        label: cluster.label,
        imageUrl: cluster.thumbUrl,
        badge: cluster.photoCount === 0 ? "moment" : "photo",
        count: cluster.points.length,
        variant: "memory",
        active: cluster.points.some((p) => p.id === selectedPointId),
      })),
    [clusters, selectedPointId],
  );

  const isMemories = activePlace !== null;
  const openCluster =
    clusters.find((c) => c.points.some((p) => p.id === selectedPointId)) ?? null;
  const selectedPlace = tripPlaces.find((tp) => tp.id === selectedId) ?? null;
  // En nivel 2 manda el lugar explorado; en nivel 1, el marcador seleccionado.
  const cardPlace = isMemories ? activePlace : selectedPlace;
  const cardContent = cardPlace
    ? (contentByPlace.get(cardPlace.id) ?? EMPTY_CONTENT)
    : EMPTY_CONTENT;

  function openPlace(tripPlaceId: string) {
    setSelectedId(tripPlaceId);
    const content = contentByPlace.get(tripPlaceId);
    // Sin ubicaciones exactas no hay nada que explorar: se queda la tarjeta del
    // lugar, que es el comportamiento de siempre.
    if (content?.located.length) {
      setView({ level: "memories", tripPlaceId });
      setSelectedPointId(null);
    }
  }

  function backToGlobal() {
    setView({ level: "global" });
    setSelectedPointId(null);
    setSelectedId(null);
  }

  /** Del id del grupo pulsado al punto que lo ancla. */
  function openClusterById(clusterId: string) {
    const cluster = clusters.find((c) => c.id === clusterId);
    setSelectedPointId(cluster?.points[0]?.id ?? null);
  }

  return (
    <div className="app-fill relative w-full">
      <MapCanvas
        // Cambiar de nivel reinicia el mapa para que vuelva a encajar la vista.
        key={isMemories ? `memories:${activePlace.id}` : "global"}
        markers={isMemories ? memoryMarkers : globalMarkers}
        selectedId={isMemories ? (openCluster?.id ?? null) : selectedId}
        onMarkerClick={(id) => (isMemories ? openClusterById(id) : openPlace(id))}
        onMapClick={() => (isMemories ? setSelectedPointId(null) : setSelectedId(null))}
        initialCenter={
          isMemories
            ? { latitude: activePlace.place.latitude, longitude: activePlace.place.longitude }
            : center
        }
        initialZoom={isMemories ? 15 : 11}
        autoFit={isMemories ? !openCluster : !selectedId}
        // Firma estable frente al zoom: en recuerdos encaja una vez al entrar.
        autoFitKey={
          isMemories
            ? `memories:${activePlace.id}:${activeContent.located.length}`
            : globalMarkers.map((m) => m.id).join(",")
        }
        fitMaxZoom={isMemories ? 17 : 14}
        onZoomChange={setZoom}
      />

      {/* Controles flotantes */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 lg:gap-3 lg:p-5">
        {isMemories ? (
          <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-xl surface-1-blur p-1.5 shadow-lg backdrop-blur">
            <Button variant="secondary" size="sm" onClick={backToGlobal}>
              <BackIcon size={14} weight="bold" aria-hidden />
              Mapa del viaje
            </Button>
            <span className="min-w-0 truncate pr-1 text-sm font-semibold ink-primary">
              <PlaceIcon size={14} weight="fill" className="mr-1 inline align-[-2px] text-brand-500" aria-hidden />
              {activePlace.place.name}
            </span>
          </div>
        ) : (
          <div className="pointer-events-auto min-w-0 rounded-xl surface-1-blur p-1 shadow-lg backdrop-blur">
            <SegmentedControl<Mode>
              value={mode}
              onChange={(next) => {
                setMode(next);
                setSelectedId(null);
              }}
              options={[
                { value: "places", label: "Lugares", Icon: PlaceIcon, count: tripPlaces.length },
                { value: "photos", label: "Con recuerdos", Icon: MomentIcon, count: placesWithContent.length },
              ]}
              className="bg-transparent"
            />
          </div>
        )}

        {!isMemories && (
          <Button className="pointer-events-auto shrink-0 shadow-lg" onClick={() => setAdding(true)}>
            + Lugar
          </Button>
        )}
      </div>

      {!isMemories && globalMarkers.length === 0 && (
        <EmptyOverlay
          text={
            mode === "photos"
              ? "Todavía no hay lugares con recuerdos. Sube fotos o crea momentos y sitúalos."
              : "Aún no hay lugares en el mapa. Busca uno real con “+ Lugar”."
          }
        />
      )}
      {isMemories && memoryMarkers.length === 0 && (
        <EmptyOverlay text="Este lugar aún no tiene recuerdos con ubicación exacta." />
      )}

      {/* Nivel 2: tarjeta del recuerdo abierto. */}
      {isMemories && openCluster && (
        <MemoryCard
          cluster={openCluster}
          members={members}
          onClose={() => setSelectedPointId(null)}
          onOpenPhoto={(photo, list) => setLightbox({ photo, photos: list })}
        />
      )}

      {/* Tarjeta del lugar: en global al seleccionarlo, y en recuerdos como
          contexto mientras no haya un recuerdo abierto. */}
      {cardPlace && !(isMemories && openCluster) && (
        <PlaceCard
          tripPlace={cardPlace}
          content={cardContent}
          expenseTotal={expenseStats.total.get(cardPlace.id) ?? 0}
          currency={trip?.baseCurrency ?? "EUR"}
          exploring={isMemories}
          onExplore={() => openPlace(cardPlace.id)}
          onClose={() => (isMemories ? backToGlobal() : setSelectedId(null))}
          onOpenPhoto={(photo) => setLightbox({ photo, photos: cardContent.photos })}
        />
      )}

      <PlacePicker
        open={adding}
        onClose={() => setAdding(false)}
        onSelect={(tp) => setSelectedId(tp.id)}
        title="Añadir lugar al viaje"
      />

      {lightbox && (
        <PhotoLightbox
          photo={lightbox.photo}
          photos={lightbox.photos}
          onNavigate={(photo) => setLightbox({ photo, photos: lightbox.photos })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function EmptyOverlay({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6">
      <p className="pointer-events-auto rounded-2xl surface-1-blur px-5 py-4 text-center text-sm ink-secondary shadow-lg backdrop-blur">
        {text}
      </p>
    </div>
  );
}

/** Tarjeta del lugar del itinerario (nivel 1). */
function PlaceCard({
  tripPlace,
  content,
  expenseTotal,
  currency,
  exploring,
  onExplore,
  onClose,
  onOpenPhoto,
}: {
  tripPlace: TripPlace;
  content: PlaceContent;
  expenseTotal: number;
  currency: string;
  exploring: boolean;
  onExplore: () => void;
  onClose: () => void;
  onOpenPhoto: (photo: Photo) => void;
}) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 animate-rise lg:inset-x-auto lg:bottom-5 lg:left-5 lg:w-96">
      <div className="app-scroll-y max-h-[60vh] overflow-hidden rounded-2xl border border-subtle surface-1 shadow-2xl lg:max-h-[70vh]">
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold ink-primary">{tripPlace.place.name}</p>
            {tripPlace.place.address && (
              <p className="truncate text-xs ink-muted">{tripPlace.place.address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={exploring ? "Volver al mapa del viaje" : "Cerrar"}
            className="rounded-lg p-1 ink-muted hover:surface-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-4 gap-1.5 px-4 text-center">
          <Stat label="Fotos" value={String(content.photos.length)} />
          <Stat label="Momentos" value={String(content.moments.length)} />
          <Stat label="Gasto" value={formatMoney(expenseTotal, currency, { compact: true })} />
          <Stat label="Estado" value={tripPlace.status === "visited" ? "Visitado" : "Pendiente"} />
        </dl>

        {tripPlace.rating !== null && (
          <div className="mt-3 px-4">
            <Rating value={tripPlace.rating} readOnly />
          </div>
        )}

        {tripPlace.notes && <p className="mt-3 px-4 text-sm ink-secondary">{tripPlace.notes}</p>}

        {!exploring && content.located.length > 0 && (
          <div className="mt-3 px-4">
            <Button className="w-full" onClick={onExplore}>
              <MomentIcon size={16} weight="fill" aria-hidden />
              Explorar recuerdos ({content.located.length})
            </Button>
          </div>
        )}

        {exploring && content.unlocated > 0 && (
          <p className="mt-3 px-4 text-xs ink-muted">
            {content.unlocated} recuerdo{content.unlocated === 1 ? "" : "s"} de este lugar sin
            ubicación exacta: no aparecen en el mapa.
          </p>
        )}

        {content.photos.length > 0 && (
          <div className="app-scroll-x no-scrollbar mt-3 flex gap-2 px-4 pb-4">
            {content.photos.slice(0, 8).map((photo) => (
              <button
                key={photo.id}
                onClick={() => onOpenPhoto(photo)}
                className="h-16 w-16 shrink-0 overflow-hidden rounded-lg surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbUrl ?? photo.url}
                  alt={photo.description ?? ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {content.photos.length === 0 && <div className="pb-4" />}
      </div>
    </div>
  );
}

/** Tarjeta de una ubicacion exacta del mapa de recuerdos (nivel 2). */
function MemoryCard({
  cluster,
  members,
  onClose,
  onOpenPhoto,
}: {
  cluster: MemoryCluster;
  members: TripMember[];
  onClose: () => void;
  onOpenPhoto: (photo: Photo, list: Photo[]) => void;
}) {
  const photos = cluster.points
    .flatMap((p) => (p.kind === "moment" ? (p.moment?.photos ?? []) : p.photo ? [p.photo] : []))
    .filter((photo, index, list) => list.findIndex((x) => x.id === photo.id) === index);
  const moments = cluster.points.map((p) => p.moment).filter((m): m is Moment => m !== null);

  const authorId = moments[0]?.createdBy ?? cluster.points[0]?.photo?.uploadedBy ?? null;
  const author: PublicProfile | null = members.find((m) => m.userId === authorId)?.profile ?? null;
  const date = cluster.points[0]?.date ?? null;

  return (
    <div className="absolute inset-x-3 bottom-3 z-10 animate-rise lg:inset-x-auto lg:bottom-5 lg:left-5 lg:w-96">
      <div className="app-scroll-y max-h-[60vh] overflow-hidden rounded-2xl border border-subtle surface-1 shadow-2xl lg:max-h-[70vh]">
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold ink-primary">{cluster.label}</p>
            <p className="flex items-center gap-1.5 truncate text-xs ink-muted">
              {author && <Avatar profile={author} size="xs" />}
              <span className="truncate">
                {author?.name ?? "Alguien"}
                {date ? ` · ${formatDate(date, "long")}` : ""}
              </span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 ink-muted hover:surface-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {moments.length > 0 && (
          <ul className="mt-3 space-y-2 px-4">
            {moments.map((moment) => (
              <li key={moment.id} className="rounded-xl surface-2 px-3 py-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold ink-primary">
                  <MomentIcon size={14} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
                  <span className="min-w-0 truncate">{moment.title}</span>
                </p>
                {moment.description && (
                  <p className="mt-0.5 text-xs ink-secondary">{moment.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {photos[0]?.description && (
          <p className="mt-3 px-4 text-sm ink-secondary">{photos[0].description}</p>
        )}

        {photos.length > 0 ? (
          <div className="app-scroll-x no-scrollbar mt-3 flex gap-2 px-4 pb-4">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => onOpenPhoto(photo, photos)}
                className="h-20 w-20 shrink-0 overflow-hidden rounded-lg surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbUrl ?? photo.url}
                  alt={photo.description ?? ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="pb-4" />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl surface-2 px-1.5 py-2">
      <dt className="text-[10px] uppercase tracking-wide ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold ink-primary">{value}</dd>
    </div>
  );
}
