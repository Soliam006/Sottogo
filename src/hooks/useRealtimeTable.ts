"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/services/supabase/client";

/**
 * Contador de canales. Cada ejecucion del efecto estrena topico.
 *
 * `RealtimeClient.channel(topic)` REUTILIZA el canal si el topico ya existe, y
 * `RealtimeChannel.on()` lanza `cannot add postgres_changes callbacks ... after
 * subscribe()` si ese canal ya estaba suscrito. Con un topico derivado solo del
 * viaje y la tabla chocaban dos casos reales:
 *
 *   1. Dos componentes escuchando la misma tabla del mismo viaje.
 *   2. StrictMode en desarrollo: monta, limpia y vuelve a montar; como
 *      `removeChannel` es asincrono, el segundo montaje encontraba el canal
 *      todavia unido.
 *
 * Un topico irrepetible elimina las dos. Los canales son baratos: comparten el
 * mismo websocket.
 */
let channelSeq = 0;

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
    if (!tripId || !key) return;

    const db = getSupabaseBrowserClient();
    const channel = db.channel(`trip:${tripId}:${key}#${++channelSeq}`);

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
