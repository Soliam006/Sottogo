"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { formatHandle, type PublicProfile, type TripInvitation } from "@/core/models";
import { CURRENCIES } from "@/core/currency";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { invitationsRepo, tripsRepo } from "@/services/repositories";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Misc";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export function TripSettingsView() {
  const { trip, members, isOwner, refresh } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();

  const tripId = trip?.id ?? "";

  const loadInvitations = useCallback(async () => {
    if (!tripId) return [];
    return invitationsRepo.listForTrip(getSupabaseBrowserClient(), tripId);
  }, [tripId]);

  const invitations = useAsyncData<TripInvitation[]>(loadInvitations, [tripId]);

  // --- Datos del viaje ------------------------------------------------------
  const [name, setName] = useState(trip?.name ?? "");
  const [currency, setCurrency] = useState(trip?.baseCurrency ?? "EUR");
  const [startDate, setStartDate] = useState(trip?.startDate ?? "");
  const [endDate, setEndDate] = useState(trip?.endDate ?? "");
  const [coverImage, setCoverImage] = useState(trip?.coverImage ?? "");
  const [savingTrip, setSavingTrip] = useState(false);

  // --- Invitar --------------------------------------------------------------
  const [handle, setHandle] = useState("");
  const [found, setFound] = useState<PublicProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  if (!trip) return null;

  async function saveTrip() {
    setSavingTrip(true);
    try {
      await tripsRepo.update(getSupabaseBrowserClient(), tripId, {
        name,
        baseCurrency: currency,
        startDate,
        endDate,
        coverImage: coverImage.trim() || null,
      });
      toast("Viaje actualizado");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSavingTrip(false);
    }
  }

  async function search() {
    setSearchError(null);
    setFound(null);
    setSearching(true);
    try {
      const profile = await invitationsRepo.findByHandle(getSupabaseBrowserClient(), handle);
      if (!profile) setSearchError("No existe ningún usuario con ese identificador.");
      else if (members.some((m) => m.userId === profile.id))
        setSearchError("Esa persona ya participa en el viaje.");
      else setFound(profile);
    } catch (err) {
      setSearchError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function invite() {
    if (!found || !session?.user) return;
    try {
      await invitationsRepo.invite(getSupabaseBrowserClient(), tripId, session.user.id, found.id);
      toast(`Invitación enviada a ${found.name}`);
      setFound(null);
      setHandle("");
      await invitations.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function removeMember(memberId: string, memberName: string) {
    const ok = await confirm({
      title: "Quitar participante",
      body: `${memberName} dejará de tener acceso al viaje.`,
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    try {
      await tripsRepo.removeMember(getSupabaseBrowserClient(), memberId);
      toast("Participante eliminado", "info");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function deleteTrip() {
    const ok = await confirm({
      title: "Eliminar viaje",
      body: `Se eliminarán todos los gastos, lugares, fotos y momentos de “${trip!.name}”. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await tripsRepo.remove(getSupabaseBrowserClient(), tripId);
      toast("Viaje eliminado", "info");
      router.push("/trips");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const pending = (invitations.data ?? []).filter((i) => i.status === "pending");

  return (
    <div className="app-page max-w-3xl space-y-6">
      <PageHeader title="Configuración" subtitle={trip.name} />

      {/* Participantes */}
      <Card className="p-5">
        <h2 className="text-base font-semibold ink-primary">Participantes</h2>
        <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              <Avatar profile={member.profile} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium ink-primary">{member.profile.name}</p>
                <p className="truncate font-mono text-xs ink-muted">
                  {formatHandle(member.profile)}
                </p>
              </div>
              <Badge tone={member.role === "owner" ? "brand" : "neutral"}>
                {member.role === "owner" ? "Propietario" : "Participante"}
              </Badge>
              {isOwner && member.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeMember(member.id, member.profile.name)}
                >
                  Quitar
                </Button>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <div className="mt-5 rounded-2xl surface-2 p-4">
            <p className="text-sm font-medium ink-primary">Añadir compañero</p>
            <p className="mt-0.5 text-xs ink-muted">
              Busca por su identificador público, con el formato Nombre#0000.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
              className="mt-3 flex gap-2"
            >
              <TextInput
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Mei#7314"
                className="font-mono"
              />
              <Button type="submit" loading={searching} variant="secondary">
                Buscar
              </Button>
            </form>

            {searchError && (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{searchError}</p>
            )}

            {found && (
              <div className="mt-3 flex items-center gap-3 rounded-xl surface-1 px-3 py-2.5">
                <Avatar profile={found} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium ink-primary">{found.name}</p>
                  <p className="truncate font-mono text-xs ink-muted">{formatHandle(found)}</p>
                </div>
                <Button size="sm" onClick={() => void invite()}>
                  Invitar al viaje
                </Button>
              </div>
            )}

            {pending.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide ink-muted">
                  Invitaciones pendientes
                </p>
                <ul className="mt-2 space-y-1.5">
                  {pending.map((invitation) => (
                    <li key={invitation.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate ink-secondary">
                        {invitation.receiver ? formatHandle(invitation.receiver) : "—"} ·{" "}
                        {formatDate(invitation.createdAt)}
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            await invitationsRepo.cancel(getSupabaseBrowserClient(), invitation.id);
                            await invitations.refresh();
                          } catch (err) {
                            toast(errorMessage(err), "error");
                          }
                        }}
                        className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                      >
                        Cancelar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Datos del viaje */}
      {isOwner && (
        <Card className="p-5">
          <h2 className="text-base font-semibold ink-primary">Datos del viaje</h2>
          <div className="mt-4 space-y-4">
            <Field label="Nombre">
              {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Inicio">
                {(id) => (
                  <TextInput id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                )}
              </Field>
              <Field label="Fin">
                {(id) => (
                  <TextInput id={id} type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                )}
              </Field>
            </div>

            <Field label="Moneda principal">
              {(id) => (
                <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Imagen de portada" hint="URL de una imagen.">
              {(id) => (
                <TextInput
                  id={id}
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://…"
                />
              )}
            </Field>

            <Button onClick={() => void saveTrip()} loading={savingTrip}>
              Guardar cambios
            </Button>
          </div>
        </Card>
      )}

      {isOwner && (
        <Card className="border-rose-200 p-5 dark:border-rose-900/50">
          <h2 className="text-base font-semibold text-rose-700 dark:text-rose-400">Zona peligrosa</h2>
          <p className="mt-1 text-sm ink-secondary">
            Eliminar el viaje borra de forma permanente todo su contenido.
          </p>
          <Button variant="danger" className="mt-4" onClick={() => void deleteTrip()}>
            Eliminar viaje
          </Button>
        </Card>
      )}

      {confirmDialog}
    </div>
  );
}
