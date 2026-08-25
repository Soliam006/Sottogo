"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/services/supabase/client";

/**
 * Suscripcion realtime a los cambios de una tabla filtrados por viaje.
 * Permite que un gasto anadido por otro participante aparezca sin recargar.
 */
export function useRealtimeTables(
  tripId: string | null,
  tables: string[],
  onChange: () => void,
): void {
  const callback = useRef(onChange);
  callback.current = onChange;

  const key = tables.join(",");

  useEffect(() => {
    if (!tripId) return;

    const db = getSupabaseBrowserClient();
    const channel = db.channel(`trip:${tripId}:${key}`);

    for (const table of key.split(",")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `trip_id=eq.${tripId}` },
        () => callback.current(),
      );
    }

    channel.subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [tripId, key]);
}
