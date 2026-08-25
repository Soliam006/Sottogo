"use client";

import { useMemo, useState } from "react";
import type { Photo } from "@/core/models";
import { baseAmount, totalsByCategory } from "@/core/expenses/balance";
import { daysBetween, flagEmoji, formatDate, formatMoney } from "@/lib/format";
import { useTrip } from "@/components/providers/TripProvider";
import { useExpenses, useMoments, usePhotos } from "@/hooks/useTripCollections";
import { Card } from "@/components/ui/Card";
import { ExpenseIcon, FavouriteIcon, GalleryIcon, Icon, ImageIcon, MapIcon, MedalAwardIcon, PlaceIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/States";
import { MapCanvas } from "@/components/map/MapCanvas";
import { PhotoTile } from "@/components/photos/PhotoGrid";
import { PhotoLightbox } from "@/components/photos/PhotoLightbox";
import { CategoryBars } from "@/components/expenses/CategoryBars";

/** Tonos del podio: la medalla es la misma, cambia el color. */
const MEDAL_TONES = ["text-amber-400", "text-slate-400", "text-amber-700"];

/**
 * "Resumen del viaje": la pantalla-recuerdo. Solo lectura, muy visual.
 */
export function TripSummary() {
  const { trip, tripPlaces, center, members } = useTrip();
  const tripId = trip?.id ?? "";

  const { data: expenses } = useExpenses(tripId);
  const { data: photos } = usePhotos(tripId);
  const { data: moments } = useMoments(tripId);

  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const total = useMemo(
    () => (expenses ?? []).reduce((sum, e) => sum + baseAmount(e), 0),
    [expenses],
  );
  const categories = useMemo(() => totalsByCategory(expenses ?? []), [expenses]);

  /** Ranking de lugares por numero de momentos vividos alli. */
  const ranking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const moment of moments ?? []) {
      if (!moment.tripPlaceId) continue;
      counts.set(moment.tripPlaceId, (counts.get(moment.tripPlaceId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tripPlaceId, count]) => ({
        name: tripPlaces.find((tp) => tp.id === tripPlaceId)?.place.name ?? "Lugar",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [moments, tripPlaces]);

  const featured = useMemo(() => {
    const all = photos ?? [];
    const starred = all.filter((p) => p.featured);
    return starred.length ? starred : all.slice(0, 8);
  }, [photos]);

  if (!trip) return null;

  const visited = tripPlaces.filter((tp) => tp.status === "visited").length;
  const markers = tripPlaces.map((tp) => ({
    id: tp.id,
    latitude: tp.place.latitude,
    longitude: tp.place.longitude,
    label: tp.place.name,
  }));

  return (
    <div className="app-page max-w-4xl space-y-6">
      <section
        className="overflow-hidden rounded-3xl px-6 py-10 text-center text-white sm:px-10 sm:py-14"
        style={{
          backgroundImage:
            "radial-gradient(120% 100% at 20% 0%, #4f46e5 0%, transparent 55%), radial-gradient(110% 90% at 85% 100%, #f97316 0%, transparent 55%), linear-gradient(150deg, #1e1b4b, #0b0a1f)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
          Resumen del viaje
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-tight sm:text-5xl">
          {flagEmoji(trip.countryCode)} {trip.name}
        </h1>
        <p className="mt-2 text-white/70">
          {formatDate(trip.startDate, "long")} → {formatDate(trip.endDate, "long")}
        </p>
        <p className="mt-1 text-2xl font-bold">{daysBetween(trip.startDate, trip.endDate)} días</p>

        <dl className="mt-8 grid grid-cols-3 gap-3 text-left sm:gap-6">
          <HeroStat label="Lugares visitados" value={String(visited)} icon={PlaceIcon} />
          <HeroStat label="Recuerdos" value={String((photos ?? []).length)} icon={GalleryIcon} />
          <HeroStat
            label="Gastado"
            value={formatMoney(total, trip.baseCurrency, { compact: true })}
            icon={ExpenseIcon}
          />
        </dl>
      </section>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold ink-primary"><FavouriteIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Momentos favoritos</h2>
        <p className="mt-0.5 text-sm ink-muted">Los lugares donde más habéis vivido.</p>

        {ranking.length === 0 ? (
          <p className="mt-4 text-sm ink-muted">
            Crea momentos y asígnalos a un lugar para ver aquí el ranking.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {ranking.map((entry, index) => (
              <li key={entry.name} className="flex items-center gap-3 rounded-xl surface-2 px-4 py-3">
                <MedalAwardIcon
                  size={22}
                  weight="fill"
                  className={MEDAL_TONES[index] ?? "ink-muted"}
                  aria-hidden
                />
                <span className="flex-1 truncate font-medium ink-primary">{entry.name}</span>
                <span className="text-sm tabular-nums ink-muted">
                  {entry.count} momento{entry.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold ink-primary"><GalleryIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Tus recuerdos</h2>
        <p className="mt-0.5 text-sm ink-muted">
          Marca fotos como destacadas en la galería para elegir las que aparecen aquí.
        </p>

        {featured.length === 0 ? (
          <EmptyState icon={ImageIcon} title="Sin fotos todavía" className="mt-4 border-0" />
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {featured.slice(0, 8).map((photo) => (
              <li key={photo.id}>
                <PhotoTile photo={photo} onClick={() => setLightbox(photo)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <h2 className="flex items-center gap-2 px-6 pt-6 text-base font-semibold ink-primary"><MapIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Tu ruta</h2>
        <div className="mt-4 h-80">
          {markers.length ? (
            <MapCanvas markers={markers} initialCenter={center} showControls={false} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm ink-muted">
              Sin lugares en el mapa.
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold ink-primary"><ExpenseIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Tus gastos</h2>
        <p className="mt-1 text-3xl font-bold tabular-nums ink-primary">
          {formatMoney(total, trip.baseCurrency)}
        </p>
        <p className="mt-0.5 text-sm ink-muted">
          {(expenses ?? []).length} gastos · {members.length} participante
          {members.length === 1 ? "" : "s"}
        </p>
        <div className="mt-5">
          <CategoryBars totals={categories} currency={trip.baseCurrency} />
        </div>
      </Card>

      {lightbox && (
        <PhotoLightbox
          photo={lightbox}
          photos={featured}
          onNavigate={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function HeroStat({ label, value, icon: Glyph }: { label: string; value: string; icon: Icon }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/60">
        <Glyph size={14} weight="fill" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</dd>
    </div>
  );
}
