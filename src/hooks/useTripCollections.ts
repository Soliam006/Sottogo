"use client";

import { useCallback } from "react";
import type {
  Booking,
  ChecklistItem,
  ChecklistList,
  Expense,
  ItineraryItem,
  Moment,
  MomentComment,
  Photo,
} from "@/core/models";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import {
  bookingsRepo,
  checklistRepo,
  momentCommentsRepo,
  expensesRepo,
  itineraryRepo,
  momentsRepo,
  photosRepo,
} from "@/services/repositories";
import { attachSignedUrls } from "@/services/storage/photoStorage";
import { useAsyncData, type AsyncState } from "./useAsyncData";
import { useRealtimeTables } from "./useRealtimeTable";

/**
 * Gastos del viaje, sincronizados en tiempo real entre participantes.
 *
 * `enabled` existe para los VISITANTES: los gastos son informacion privada y no
 * deben ni pedirse. Las politicas RLS ya se los negarian, pero asi ni siquiera
 * sale la peticion ni se abre la suscripcion.
 */
export function useExpenses(tripId: string, enabled = true): AsyncState<Expense[]> {
  const load = useCallback(
    async () =>
      enabled && tripId ? expensesRepo.listByTrip(getSupabaseBrowserClient(), tripId) : [],
    [tripId, enabled],
  );
  const state = useAsyncData<Expense[]>(load, [tripId, enabled]);
  useRealtimeTables(enabled ? tripId : null, ["expenses"], () => void state.refresh());
  return state;
}

/** Fotos del viaje con URLs firmadas ya resueltas. */
export function usePhotos(tripId: string): AsyncState<Photo[]> {
  const load = useCallback(async () => {
    const db = getSupabaseBrowserClient();
    const photos = await photosRepo.listByTrip(db, tripId);
    return attachSignedUrls(db, photos);
  }, [tripId]);

  const state = useAsyncData<Photo[]>(load, [tripId]);
  useRealtimeTables(tripId, ["photos"], () => void state.refresh());
  return state;
}

export function useItinerary(tripId: string): AsyncState<ItineraryItem[]> {
  const load = useCallback(
    () => itineraryRepo.listByTrip(getSupabaseBrowserClient(), tripId),
    [tripId],
  );
  const state = useAsyncData<ItineraryItem[]>(load, [tripId]);
  useRealtimeTables(tripId, ["itinerary_items"], () => void state.refresh());
  return state;
}

export function useMoments(tripId: string): AsyncState<Moment[]> {
  const load = useCallback(async () => {
    const db = getSupabaseBrowserClient();
    const moments = await momentsRepo.listByTrip(db, tripId);
    const photos = moments.flatMap((m) => m.photos ?? []);
    const signed = await attachSignedUrls(db, photos);
    const byId = new Map(signed.map((p) => [p.id, p]));
    return moments.map((m) => ({
      ...m,
      photos: (m.photos ?? []).map((p) => byId.get(p.id) ?? p),
    }));
  }, [tripId]);

  const state = useAsyncData<Moment[]>(load, [tripId]);
  useRealtimeTables(tripId, ["moments"], () => void state.refresh());
  return state;
}

/**
 * Vuelos, alojamientos y coches del viaje, en tiempo real.
 * `enabled` evita la peticion cuando quien mira no puede verlos (visitantes).
 */
export function useBookings(tripId: string, enabled = true): AsyncState<Booking[]> {
  const load = useCallback(
    async () => (enabled && tripId ? bookingsRepo.listByTrip(getSupabaseBrowserClient(), tripId) : []),
    [tripId, enabled],
  );
  const state = useAsyncData<Booking[]>(load, [tripId, enabled]);
  useRealtimeTables(enabled ? tripId : null, ["trip_bookings"], () => void state.refresh());
  return state;
}

/**
 * Comentarios de TODOS los momentos del viaje, en una sola consulta.
 * La vista los agrupa por momento.
 */
export function useMomentComments(tripId: string): AsyncState<MomentComment[]> {
  const load = useCallback(
    () => momentCommentsRepo.listByTrip(getSupabaseBrowserClient(), tripId),
    [tripId],
  );
  const state = useAsyncData<MomentComment[]>(load, [tripId]);
  useRealtimeTables(tripId, ["moment_comments"], () => void state.refresh());
  return state;
}

export function useChecklist(tripId: string): AsyncState<ChecklistItem[]> {
  const load = useCallback(
    () => checklistRepo.listByTrip(getSupabaseBrowserClient(), tripId),
    [tripId],
  );
  const state = useAsyncData<ChecklistItem[]>(load, [tripId]);
  useRealtimeTables(tripId, ["checklist_items"], () => void state.refresh());
  return state;
}

/** Las listas del apartado "Otros" (los Cards), en tiempo real. */
export function useChecklistLists(tripId: string): AsyncState<ChecklistList[]> {
  const load = useCallback(
    () => checklistRepo.listsByTrip(getSupabaseBrowserClient(), tripId),
    [tripId],
  );
  const state = useAsyncData<ChecklistList[]>(load, [tripId]);
  useRealtimeTables(tripId, ["checklist_lists"], () => void state.refresh());
  return state;
}
