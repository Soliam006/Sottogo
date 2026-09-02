"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Moment } from "@/core/models";
import { appendBatch, hasMore as hasMoreThan } from "@/core/feed";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { momentsRepo } from "@/services/repositories";
import { attachSignedUrls } from "@/services/storage/photoStorage";
import { useRealtimeTables } from "./useRealtimeTable";

/**
 * Momentos del viaje por lotes.
 *
 * Un momento ocupa casi una pantalla —la foto va a sangre—, asi que de un
 * vistazo se ven uno o dos. Traer los cincuenta del viaje para ensenar dos, con
 * sus fotos embebidas y sus firmas, era el mismo desperdicio que tenia la
 * galeria.
 *
 * Comparte con ella `core/feed` (fusion de lotes) y el componente `LoadMore`.
 * El resto —que consulta se hace y que hay que firmar— es distinto, y por eso
 * son dos hooks y no uno.
 */

/**
 * Cinco. Es mas que lo que cabe en pantalla, asi que siempre hay margen antes
 * de que el siguiente lote haga falta, y sigue siendo poco que traer.
 */
export const MOMENT_PAGE_SIZE = 5;

export interface MomentFeed {
  moments: Moment[];
  /** Cuantos hay en el viaje. */
  total: number;
  /** Primera carga: no hay nada que ensenar todavia. */
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

export function useMomentFeed(tripId: string): MomentFeed {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Paginas cargadas. Al refrescar se vuelven a pedir todas. */
  const pages = useRef(1);
  /** Espejo de `moments`, para fusionar sin efectos dentro de un actualizador. */
  const loaded = useRef<Moment[]>([]);
  /** Descarta respuestas que ya no son la ultima peticion. */
  const request = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Firma las fotos de los momentos del lote y las devuelve resueltas. */
  const withPhotos = useCallback(async (batch: Moment[]): Promise<Moment[]> => {
    const db = getSupabaseBrowserClient();
    const photos = batch.flatMap((moment) => moment.photos ?? []);
    if (!photos.length) return batch;

    const signed = await attachSignedUrls(db, photos);
    const byId = new Map(signed.map((photo) => [photo.id, photo]));
    return batch.map((moment) => ({
      ...moment,
      photos: (moment.photos ?? []).map((photo) => byId.get(photo.id) ?? photo),
    }));
  }, []);

  const loadFromStart = useCallback(
    async (count: number) => {
      if (!tripId) return;
      const ticket = ++request.current;
      setError(null);

      try {
        const db = getSupabaseBrowserClient();
        const page = await momentsRepo.listPage(db, tripId, MOMENT_PAGE_SIZE * count, 0);
        const resolved = await withPhotos(page.moments);

        if (!mounted.current || ticket !== request.current) return;
        pages.current = count;
        loaded.current = resolved;
        setMoments(resolved);
        setTotal(page.total);
      } catch (err) {
        if (mounted.current && ticket === request.current) setError(errorMessage(err));
      } finally {
        if (mounted.current && ticket === request.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [tripId, withPhotos],
  );

  useEffect(() => {
    pages.current = 1;
    loaded.current = [];
    setMoments([]);
    setTotal(0);
    setLoading(true);
    void loadFromStart(1);
  }, [loadFromStart]);

  const hasMore = hasMoreThan(moments, total);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !tripId) return;
    const ticket = ++request.current;
    setLoadingMore(true);

    void (async () => {
      try {
        const db = getSupabaseBrowserClient();
        const page = await momentsRepo.listPage(
          db,
          tripId,
          MOMENT_PAGE_SIZE,
          pages.current * MOMENT_PAGE_SIZE,
        );
        const resolved = await withPhotos(page.moments);

        if (!mounted.current || ticket !== request.current) return;
        pages.current += 1;

        const next = appendBatch(loaded.current, { items: resolved, total: page.total });
        loaded.current = next.items;
        setMoments(next.items);
        setTotal(next.total);
      } catch (err) {
        if (mounted.current && ticket === request.current) setError(errorMessage(err));
      } finally {
        if (mounted.current && ticket === request.current) setLoadingMore(false);
      }
    })();
  }, [loading, loadingMore, hasMore, tripId, withPhotos]);

  const refresh = useCallback(() => loadFromStart(pages.current), [loadFromStart]);

  // Al crear o borrar un momento se recargan las paginas que hubiera, no solo
  // la primera: si estabas por la cuarta, sigues por la cuarta.
  useRealtimeTables(tripId || null, ["moments"], () => void refresh());

  return { moments, total, loading, error, hasMore, loadMore, refresh };
}
