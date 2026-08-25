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
import { BackIcon } from "@/components/ui/icons";
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
          <Link
            href="/trips"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] ink-muted hover:ink-secondary"
          >
            <BackIcon size={14} weight="bold" aria-hidden />
            Mis viajes
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
          {TRIP_NAV.map((item) => {
            const active = isActive(item.segment);
            return (
              <Link
                key={item.key}
                href={tripHref(trip.id, item.segment)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    : "ink-secondary hover:surface-2",
                )}
              >
                {/* El relleno marca la seccion activa sin depender del color. */}
                <item.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-40 flex h-[var(--app-header-h)] items-center justify-between gap-3 border-b border-subtle surface-1-blur px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 flex-col justify-center lg:hidden">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1 truncate text-[11px] font-semibold uppercase tracking-wider ink-muted"
            >
              <BackIcon size={12} weight="bold" aria-hidden />
              Mis viajes
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
          {primary.map((item) => {
            const active = isActive(item.segment);
            return (
              <Link
                key={item.key}
                href={tripHref(trip.id, item.segment)}
                className={cn(
                  "flex h-[var(--app-nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors",
                  active ? "text-brand-600 dark:text-brand-300" : "ink-muted",
                )}
              >
                <item.Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex h-[var(--app-nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ink-muted"
          >
            <MoreGlyph />
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
                <item.Icon size={20} weight="fill" className="text-brand-600" aria-hidden />
                {item.label}
              </Link>
            ))}
          </div>
        </Modal>
      </div>
    </div>
  );
}

/** Tres puntos del boton "Más": dibujados para pesar igual que los iconos. */
function MoreGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <circle cx="128" cy="128" r="16" />
      <circle cx="64" cy="128" r="16" />
      <circle cx="192" cy="128" r="16" />
    </svg>
  );
}
