"use client";

import { useCallback } from "react";
import type { ChecklistItem, Expense, ItineraryItem, Moment, Photo } from "@/core/models";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import {
  checklistRepo,
  expensesRepo,
  itineraryRepo,
  momentsRepo,
  photosRepo,
} from "@/services/repositories";
import { attachSignedUrls } from "@/services/storage/photoStorage";
import { useAsyncData, type AsyncState } from "./useAsyncData";
import { useRealtimeTables } from "./useRealtimeTable";

/** Gastos del viaje, sincronizados en tiempo real entre participantes. */
export function useExpenses(tripId: string): AsyncState<Expense[]> {
  const load = useCallback(
    () => expensesRepo.listByTrip(getSupabaseBrowserClient(), tripId),
    [tripId],
  );
  const state = useAsyncData<Expense[]>(load, [tripId]);
  useRealtimeTables(tripId, ["expenses"], () => void state.refresh());
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

export function useChecklist(tripId: string): AsyncState<ChecklistItem[]> {
  const load = useCallback(
    () => checklistRepo.listByTrip(getSupabaseBrowserClient(), tripId),
    [tripId],
  );
  const state = useAsyncData<ChecklistItem[]>(load, [tripId]);
  useRealtimeTables(tripId, ["checklist_items"], () => void state.refresh());
  return state;
}
