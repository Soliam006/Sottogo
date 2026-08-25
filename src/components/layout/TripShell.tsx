"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { flagEmoji, formatDateRange } from "@/lib/format";
import { useTrip } from "@/components/providers/TripProvider";
import { AvatarStack } from "@/components/ui/Avatar";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";
import { TRIP_NAV, tripHref } from "./navigation";

export function TripShell({ children }: { children: React.ReactNode }) {
  const { trip, members, loading, error, refresh } = useTrip();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (loading && !trip) {
    return <LoadingState label="Cargando viaje…" className="min-h-dvh" />;
  }
  if (error || !trip) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState
          message={error ?? "No se ha encontrado el viaje o no tienes acceso."}
          onRetry={() => void refresh()}
        />
        <p className="mt-6 text-center">
          <Link href="/trips" className="text-sm font-medium text-brand-600 underline underline-offset-4">
            ← Volver a mis viajes
          </Link>
        </p>
      </div>
    );
  }

  const isActive = (segment: string) => {
    const href = tripHref(trip.id, segment);
    return segment === "" ? pathname === href : pathname.startsWith(href);
  };

  const primary = TRIP_NAV.filter((item) => item.primary);
  const secondary = TRIP_NAV.filter((item) => !item.primary);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar - desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-subtle surface-1 lg:flex xl:w-72">
        <div className="px-5 py-5">
          <Link href="/trips" className="text-xs font-semibold uppercase tracking-[0.18em] ink-muted">
            ← Mis viajes
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-lg font-bold leading-tight ink-primary">
            <span aria-hidden>{flagEmoji(trip.countryCode)}</span>
            <span className="truncate">{trip.name}</span>
          </h1>
          <p className="mt-1 text-xs ink-muted">
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>
          <div className="mt-3">
            <AvatarStack profiles={members.map((m) => m.profile)} />
          </div>
        </div>

        {/* Scroll interno intencionado: 10 secciones en pantallas bajas. */}
        <nav className="app-scroll-y min-h-0 flex-1 space-y-0.5 px-3 pb-6">
          {TRIP_NAV.map((item) => (
            <Link
              key={item.key}
              href={tripHref(trip.id, item.segment)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(item.segment)
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                  : "ink-secondary hover:surface-2",
              )}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-40 flex h-[var(--app-header-h)] items-center justify-between gap-3 border-b border-subtle surface-1-blur px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 flex-col justify-center lg:hidden">
            <Link
              href="/trips"
              className="truncate text-[11px] font-semibold uppercase tracking-wider ink-muted"
            >
              ← Mis viajes
            </Link>
            <p className="truncate text-sm font-bold leading-tight ink-primary">
              {flagEmoji(trip.countryCode)} {trip.name}
            </p>
          </div>
          <div className="hidden lg:block" />
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        {/* Scroll del documento. `app-nav-gap` reserva justo el alto de la
            navegacion inferior movil (0 en desktop), sin numeros a mano. */}
        <main className="app-nav-gap min-w-0 flex-1">{children}</main>

        {/* Navegacion inferior - movil */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-subtle surface-1-blur backdrop-blur lg:hidden">
          {primary.map((item) => (
            <Link
              key={item.key}
              href={tripHref(trip.id, item.segment)}
              className={cn(
                "flex h-[var(--app-nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                isActive(item.segment) ? "text-brand-600 dark:text-brand-300" : "ink-muted",
              )}
            >
              <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex h-[var(--app-nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ink-muted"
          >
            <span className="text-lg leading-none" aria-hidden>⋯</span>
            <span className="max-w-full truncate">Más</span>
          </button>
        </nav>

        <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Más secciones">
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            {secondary.map((item) => (
              <Link
                key={item.key}
                href={tripHref(trip.id, item.segment)}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-subtle px-3 py-3 text-sm font-medium ink-primary transition-colors hover:surface-2"
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </Modal>
      </div>
    </div>
  );
}
