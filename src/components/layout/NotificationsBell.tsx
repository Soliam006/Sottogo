"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TripInvitation } from "@/core/models";
import { formatDateRange } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { invitationsRepo } from "@/services/repositories";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { NotificationIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";

/**
 * Notificaciones in-app: invitaciones a viajes.
 * Se refrescan en tiempo real (canal filtrado por receptor).
 */
export function NotificationsBell() {
  const { session } = useSession();
  const { toast } = useToast();
  const router = useRouter();

  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const userId = session?.user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const db = getSupabaseBrowserClient();
      setInvitations(await invitationsRepo.listIncoming(db, userId));
    } catch {
      // Silencioso: las notificaciones no deben romper la navegacion.
    }
  }, [userId]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!userId) return;
    void loadRef.current();

    const db = getSupabaseBrowserClient();
    const channel = db
      .channel(`invitations:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_invitations",
          filter: `receiver_id=eq.${userId}`,
        },
        () => void loadRef.current(),
      )
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [userId]);

  async function respond(invitation: TripInvitation, accept: boolean) {
    setBusy(invitation.id);
    try {
      const db = getSupabaseBrowserClient();
      await invitationsRepo.respond(db, invitation.id, accept);
      await load();
      toast(accept ? `Te has unido a “${invitation.trip?.name}”` : "Invitación rechazada", "info");
      if (accept) {
        setOpen(false);
        router.push(`/trips/${invitation.tripId}`);
        router.refresh();
      }
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  const count = invitations.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={count ? `${count} invitaciones pendientes` : "Notificaciones"}
        className="relative rounded-xl p-2 ink-secondary transition-colors hover:surface-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9a6 6 0 1 1 12 0c0 3.1.8 4.9 1.5 5.9.4.6 0 1.4-.7 1.4H5.2c-.7 0-1.1-.8-.7-1.4C5.2 13.9 6 12.1 6 9Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sunset-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Notificaciones">
        {count === 0 ? (
          <EmptyState icon={NotificationIcon} title="Todo al día" description="No tienes invitaciones pendientes." />
        ) : (
          <ul className="space-y-3">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="rounded-2xl border border-subtle p-4">
                <p className="text-sm ink-primary">
                  <span className="font-semibold">{invitation.sender?.name ?? "Alguien"}</span> te ha
                  invitado al viaje{" "}
                  <span className="font-semibold">“{invitation.trip?.name}”</span>.
                </p>
                {invitation.trip && (
                  <p className="mt-1 text-xs ink-muted">
                    {invitation.trip.destination} ·{" "}
                    {formatDateRange(invitation.trip.startDate, invitation.trip.endDate)}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    loading={busy === invitation.id}
                    onClick={() => void respond(invitation, true)}
                  >
                    Aceptar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === invitation.id}
                    onClick={() => void respond(invitation, false)}
                  >
                    Rechazar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
