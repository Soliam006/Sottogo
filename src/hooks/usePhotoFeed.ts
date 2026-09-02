"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/core/models";
import { appendBatch, hasMore as hasMoreThan } from "@/core/photos/feed";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { photosRepo } from "@/services/repositories";
import { attachSignedUrls } from "@/services/storage/photoStorage";
import { useRealtimeTables } from "./useRealtimeTable";

/**
 * Fotos del viaje por lotes.
 *
 * `usePhotos()` trae el viaje entero y firma dos URL por foto de una tacada.
 * Con 500 fotos eso son 500 filas y 1.000 firmas cada vez que se abre la
 * Galeria, para pintar una pantalla. Aqui se pide lo que cabe y se sigue
 * pidiendo segun se baja.
 *
 * El filtro de galeria va en la CONSULTA, no en memoria: cambiar de "Galeria" a
 * "Todas" es otra consulta, no traerlo todo y descartar.
 */

/**
 * La cuadricula va de 3 columnas en movil a 6 en escritorio: 24 son entre 4 y 8
 * filas, suficiente para llenar la pantalla sin pasarse.
 */
export const PHOTO_PAGE_SIZE = 24;

export interface PhotoFeed {
  /** Las cargadas hasta ahora, en orden. */
  photos: Photo[];
  /** Cuantas hay con el filtro actual. */
  total: number;
  /** Totales del viaje, para los rotulos y el selector de ambito. */
  totals: { all: number; gallery: number };
  /** Primera carga: no hay nada que ensenar todavia. */
  loading: boolean;
  /** Trayendo un lote mas, con contenido ya en pantalla. */
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

export function usePhotoFeed(tripId: string, onlyGallery: boolean): PhotoFeed {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ all: 0, gallery: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Paginas ya cargadas. Al refrescar se vuelven a pedir todas ellas. */
  const pages = useRef(1);
  /**
   * Espejo de `photos`. Permite fusionar un lote nuevo y decidir el total sin
   * meter efectos dentro de un actualizador de estado, que React puede llamar
   * dos veces.
   */
  const loaded = useRef<Photo[]>([]);
  /**
   * Cada peticion se queda con su numero. Si al volver ya no es la ultima, se
   * descarta: cambiar de ambito dos veces rapido no debe dejar el lote viejo.
   */
  const request = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Trae `count` paginas desde el principio y reemplaza lo que hubiera. */
  const loadFromStart = useCallback(
    async (count: number) => {
      if (!tripId) return;
      const ticket = ++request.current;
      setError(null);

      try {
        const db = getSupabaseBrowserClient();
        const [page, counts] = await Promise.all([
          photosRepo.listPage(db, tripId, {
            limit: PHOTO_PAGE_SIZE * count,
            offset: 0,
            onlyGallery,
          }),
          photosRepo.countByTrip(db, tripId),
        ]);
        const signed = await attachSignedUrls(db, page.photos);

        if (!mounted.current || ticket !== request.current) return;
        pages.current = count;
        loaded.current = signed;
        setPhotos(signed);
        setTotal(page.total);
        setTotals(counts);
      } catch (err) {
        if (mounted.current && ticket === request.current) setError(errorMessage(err));
      } finally {
        if (mounted.current && ticket === request.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [tripId, onlyGallery],
  );

  // Cambiar de viaje o de ambito empieza de cero.
  useEffect(() => {
    pages.current = 1;
    loaded.current = [];
    setPhotos([]);
    setTotal(0);
    setLoading(true);
    void loadFromStart(1);
  }, [loadFromStart]);

  const hasMore = hasMoreThan(photos, total);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !tripId) return;
    const ticket = ++request.current;
    setLoadingMore(true);

    void (async () => {
      try {
        const db = getSupabaseBrowserClient();
        const page = await photosRepo.listPage(db, tripId, {
          limit: PHOTO_PAGE_SIZE,
          offset: pages.current * PHOTO_PAGE_SIZE,
          onlyGallery,
        });
        const signed = await attachSignedUrls(db, page.photos);

        if (!mounted.current || ticket !== request.current) return;
        pages.current += 1;

        // La fusion (sin repetidas, y con el total corregido si el lote viene
        // vacio) vive en `core/photos/feed` para poder probarla sin navegador.
        const next = appendBatch(loaded.current, { photos: signed, total: page.total });
        loaded.current = next.photos;
        setPhotos(next.photos);
        setTotal(next.total);
      } catch (err) {
        if (mounted.current && ticket === request.current) setError(errorMessage(err));
      } finally {
        if (mounted.current && ticket === request.current) setLoadingMore(false);
      }
    })();
  }, [loading, loadingMore, hasMore, tripId, onlyGallery]);

  const refresh = useCallback(() => loadFromStart(pages.current), [loadFromStart]);

  // Al subir o borrar una foto se recargan las paginas que hubiera, no solo la
  // primera: si estabas por la cuarta, sigues por la cuarta.
  useRealtimeTables(tripId || null, ["photos"], () => void refresh());

  return {
    photos,
    total,
    totals,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
