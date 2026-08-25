"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Trip, TripMember, TripPlace, TripRole } from "@/core/models";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { placesRepo, tripsRepo } from "@/services/repositories";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useRealtimeTables } from "@/hooks/useRealtimeTable";
import { useSession } from "./SessionProvider";

interface TripBundle {
  trip: Trip;
  members: TripMember[];
  tripPlaces: TripPlace[];
}

interface TripContextValue {
  trip: Trip | null;
  members: TripMember[];
  tripPlaces: TripPlace[];
  role: TripRole | null;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Centro del mapa: media de los lugares o, si no hay, sin sesgo. */
  center: { latitude: number; longitude: number } | null;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ tripId, children }: { tripId: string; children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const load = useCallback(async (): Promise<TripBundle> => {
    const db = getSupabaseBrowserClient();
    const [trip, members, tripPlaces] = await Promise.all([
      tripsRepo.get(db, tripId),
      tripsRepo.listMembers(db, tripId),
      placesRepo.listByTrip(db, tripId),
    ]);
    return { trip, members, tripPlaces };
  }, [tripId]);

  const { data, loading, error, refresh } = useAsyncData<TripBundle>(load, [tripId]);

  useRealtimeTables(tripId, ["trip_members", "trip_places"], () => {
    void refresh();
  });

  const value = useMemo<TripContextValue>(() => {
    const members = data?.members ?? [];
    const tripPlaces = data?.tripPlaces ?? [];
    const role = members.find((m) => m.userId === userId)?.role ?? null;

    const located = tripPlaces.filter((p) => p.place.latitude && p.place.longitude);
    const center = located.length
      ? {
          latitude: located.reduce((sum, p) => sum + p.place.latitude, 0) / located.length,
          longitude: located.reduce((sum, p) => sum + p.place.longitude, 0) / located.length,
        }
      : null;

    return {
      trip: data?.trip ?? null,
      members,
      tripPlaces,
      role,
      isOwner: role === "owner",
      loading,
      error,
      refresh,
      center,
    };
  }, [data, loading, error, refresh, userId]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip debe usarse dentro de <TripProvider>");
  return ctx;
}
