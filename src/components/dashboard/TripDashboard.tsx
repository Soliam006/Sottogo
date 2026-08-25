"use client";

import { useMemo } from "react";
import Link from "next/link";
import { baseAmount } from "@/core/expenses/balance";
import { daysBetween, flagEmoji, formatDate, formatDateRange, formatMoney, formatTime, todayISO } from "@/lib/format";
import { useTrip } from "@/components/providers/TripProvider";
import { useExpenses, useItinerary, useMoments, usePhotos } from "@/hooks/useTripCollections";
import { AvatarStack } from "@/components/ui/Avatar";
import { ExpenseIcon, GalleryIcon, Icon, ItineraryIcon, MapIcon, MomentIcon, PlaceIcon } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { ItineraryItemIcon } from "@/components/ui/iconFor";
import { ProgressBar } from "@/components/ui/Misc";
import { MapCanvas } from "@/components/map/MapCanvas";
import { PhotoTile } from "@/components/photos/PhotoGrid";

/**
 * Pantalla principal del viaje: un resumen visual, sin sobrecargar de botones.
 */
export function TripDashboard() {
  const { trip, members, tripPlaces, center } = useTrip();
  const tripId = trip?.id ?? "";

  const { data: expenses } = useExpenses(tripId);
  const { data: photos } = usePhotos(tripId);
  const { data: itinerary } = useItinerary(tripId);
  const { data: moments } = useMoments(tripId);

  const total = useMemo(
    () => (expenses ?? []).reduce((sum, e) => sum + baseAmount(e), 0),
    [expenses],
  );

  const upcoming = useMemo(() => {
    const today = todayISO();
    return (itinerary ?? []).filter((item) => item.date >= today).slice(0, 3);
  }, [itinerary]);

  const visited = tripPlaces.filter((tp) => tp.status === "visited").length;
  const markers = tripPlaces.map((tp) => ({
    id: tp.id,
    latitude: tp.place.latitude,
    longitude: tp.place.longitude,
    label: tp.place.name,
  }));

  if (!trip) return null;

  const days = daysBetween(trip.startDate, trip.endDate);
  const today = todayISO();
  const dayNumber =
    today >= trip.startDate && today <= trip.endDate ? daysBetween(trip.startDate, today) : null;

  return (
    <div className="app-page max-w-6xl space-y-5">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-8 text-white sm:px-8 sm:py-10"
        style={{
          backgroundImage: trip.coverImage
            ? `linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.25)), url(${trip.coverImage})`
            : "radial-gradient(120% 100% at 10% 0%, #4f46e5 0%, transparent 55%), radial-gradient(100% 90% at 90% 100%, #f97316 0%, transparent 55%), linear-gradient(150deg, #1e1b4b, #0b0a1f)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          {dayNumber ? `Día ${dayNumber} de ${days}` : `${days} días`}
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
          {flagEmoji(trip.countryCode)} {trip.name}
        </h1>
        <p className="mt-1 text-white/75">
          {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <AvatarStack profiles={members.map((m) => m.profile)} />
          <span className="text-sm text-white/70">
            {members.map((m) => m.profile.name).join(" + ")}
          </span>
        </div>
      </section>

      {/* Metricas */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard href={`/trips/${trip.id}/expenses`} icon={ExpenseIcon} label="Gastos" value={formatMoney(total, trip.baseCurrency, { compact: true })} />
        <MetricCard href={`/trips/${trip.id}/gallery`} icon={GalleryIcon} label="Fotos" value={String((photos ?? []).length)} />
        <MetricCard href={`/trips/${trip.id}/places`} icon={PlaceIcon} label="Lugares" value={`${visited} / ${tripPlaces.length}`} />
        <MetricCard href={`/trips/${trip.id}/moments`} icon={MomentIcon} label="Momentos" value={String((moments ?? []).length)} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Mapa */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="flex items-center gap-2 text-base font-semibold ink-primary"><MapIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Tu mapa</h2>
            <Link href={`/trips/${trip.id}/map`} className="text-sm font-medium text-brand-600 hover:underline">
              Ver completo
            </Link>
          </div>
          <div className="mt-4 h-72">
            {markers.length ? (
              <MapCanvas markers={markers} initialCenter={center} showControls={false} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm ink-muted">
                Añade lugares al viaje para verlos aquí.
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          {/* Proximo */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold ink-primary"><ItineraryIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Próximo</h2>
              <Link href={`/trips/${trip.id}/itinerary`} className="text-sm font-medium text-brand-600 hover:underline">
                Itinerario
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm ink-muted">No hay actividades planificadas.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold tabular-nums ink-muted">
                      {formatTime(item.startTime) || "—"}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium ink-primary">
                        <ItineraryItemIcon
                          icon={item.icon}
                          size={14}
                          className="shrink-0 text-brand-500"
                        />
                        <span className="min-w-0 truncate">{item.title}</span>
                      </span>
                      <span className="block truncate text-xs ink-muted">
                        {formatDate(item.date, "day")}
                        {item.tripPlace ? ` · ${item.tripPlace.place.name}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Progreso de lugares */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold ink-primary"><PlaceIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Lugares</h2>
            <div className="mt-4">
              <ProgressBar value={visited} total={tripPlaces.length} label="Visitados" />
            </div>
          </Card>
        </div>
      </div>

      {/* Ultimos momentos */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold ink-primary"><MomentIcon size={18} weight="fill" className="text-brand-500" aria-hidden />Últimos momentos</h2>
          <Link href={`/trips/${trip.id}/moments`} className="text-sm font-medium text-brand-600 hover:underline">
            Ver todos
          </Link>
        </div>

        {(moments ?? []).length === 0 ? (
          <p className="mt-3 text-sm ink-muted">
            Todavía no hay momentos. Son los recuerdos que querrás releer dentro de años.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(moments ?? []).slice(0, 3).map((moment) => (
              <li key={moment.id} className="rounded-2xl border border-subtle p-4">
                <p className="font-semibold ink-primary">{moment.title}</p>
                <p className="mt-0.5 text-xs ink-muted">
                  {formatDate(moment.date, "long")}
                  {moment.tripPlace ? ` · ${moment.tripPlace.place.name}` : ""}
                </p>
                {moment.photos && moment.photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {moment.photos.slice(0, 3).map((photo) => (
                      <PhotoTile key={photo.id} photo={photo} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MetricCard({
  href,
  icon: Glyph,
  label,
  value,
}: {
  href: string;
  icon: Icon;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-subtle surface-1 p-4 transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="flex items-center gap-1.5 text-sm ink-muted">
        <Glyph size={16} weight="fill" className="text-brand-500" aria-hidden />
        {label}
      </p>
      <p className="mt-1 truncate text-2xl font-bold tabular-nums ink-primary">{value}</p>
    </Link>
  );
}
