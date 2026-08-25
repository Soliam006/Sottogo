"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { Trip } from "@/core/models";
import { daysBetween, flagEmoji, formatDateRange } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { tripsRepo } from "@/services/repositories";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useSession } from "@/components/providers/SessionProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/Button";
import { TripIcon } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { CreateTripModal } from "./CreateTripModal";

export function TripsList() {
  const { session, profile } = useSession();
  const userId = session?.user?.id ?? null;
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return [];
    return tripsRepo.listForUser(getSupabaseBrowserClient(), userId);
  }, [userId]);

  const { data, loading, error, refresh } = useAsyncData<Trip[]>(load, [userId]);
  const trips = data ?? [];

  return (
    <div className="min-h-dvh">
      <AppHeader />

      <main className="app-page max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold ink-primary">
              {profile ? `Hola, ${profile.name}` : "Mis viajes"}
            </h1>
            <p className="mt-1 ink-muted">Todo lo que vives, en un solo sitio.</p>
          </div>
          <Button size="lg" onClick={() => setCreating(true)}>
            + Nuevo viaje
          </Button>
        </div>

        <div className="mt-8">
          {loading && !data ? (
            <LoadingState label="Cargando tus viajes…" />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void refresh()} />
          ) : trips.length === 0 ? (
            <EmptyState
              icon={TripIcon}
              title="Todavía no tienes ningún viaje"
              description="Crea tu primer viaje y empieza a añadir lugares, gastos y recuerdos."
              action={<Button onClick={() => setCreating(true)}>Crear mi primer viaje</Button>}
            />
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <TripCard trip={trip} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <CreateTripModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => void refresh()}
      />
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const days = daysBetween(trip.startDate, trip.endDate);
  const today = new Date().toISOString().slice(0, 10);
  const state =
    today < trip.startDate ? "Próximo" : today > trip.endDate ? "Terminado" : "En curso";

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-2xl border border-subtle surface-1 transition-transform hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className="relative h-40 bg-cover bg-center"
        style={{
          backgroundImage: trip.coverImage
            ? `url(${trip.coverImage})`
            : "linear-gradient(140deg, #4f46e5, #7c3aed 45%, #f97316)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {state}
        </span>
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <p className="text-xl font-bold leading-tight drop-shadow">
            {flagEmoji(trip.countryCode)} {trip.name}
          </p>
          <p className="truncate text-sm text-white/80">{trip.destination}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="ink-secondary">{formatDateRange(trip.startDate, trip.endDate)}</span>
        <span className="font-medium ink-muted">{days} días</span>
      </div>
    </Link>
  );
}
