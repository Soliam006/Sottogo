"use client";

import { useState } from "react";
import { formatHandle } from "@/core/models";
import { normalizeUsername, usernameProblem } from "@/core/identity/handle";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { profilesRepo } from "@/services/repositories";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/errors";

/**
 * Editar el perfil propio: el nombre y el usuario.
 *
 * Hasta ahora no habia ninguna forma de tocar el perfil: se creaba en el
 * registro y se quedaba asi para siempre. Va en un modal desde el menu de
 * usuario y no en una ruta nueva porque no hace falta mas: son dos campos.
 */
export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refreshProfile } = useSession();
  const { toast } = useToast();

  const [name, setName] = useState(profile?.name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const problem = usernameProblem(username);
  const nameProblem =
    name.trim().length < 2 ? "El nombre necesita al menos 2 caracteres." : null;

  // El codigo solo se mueve si el usuario cambia Y el de siempre esta cogido,
  // asi que se ensena el actual: es lo que se llevara si nadie lo ha pillado.
  const changed = name.trim() !== profile.name || username !== profile.username;

  async function save() {
    setError(null);
    if (nameProblem || problem) {
      setError(nameProblem ?? problem);
      return;
    }
    setSaving(true);
    try {
      await profilesRepo.updateMine(getSupabaseBrowserClient(), name.trim(), username);
      await refreshProfile();
      toast("Perfil actualizado");
      onClose();
    } catch (err) {
      setError(errorMessage(err, "No se ha podido guardar el perfil."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tu perfil"
      description="El nombre es lo que ven tus compañeros de viaje. El usuario es lo que compartes."
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!changed} className="flex-1">
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar profile={{ ...profile, name }} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold ink-primary">{name || "Sin nombre"}</p>
            <p className="truncate font-mono text-xs ink-muted">
              {formatHandle({ username: username || "usuario", uniqueCode: profile.uniqueCode })}
            </p>
          </div>
        </div>

        <Field label="Nombre" required error={name ? nameProblem : null} hint="Tu nombre real, con espacios y acentos si quieres.">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              maxLength={32}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Usuario"
          required
          error={username ? problem : null}
          hint="Con esto te encuentran para invitarte a un viaje. El número de detrás lo pone Voyago."
        >
          {(id) => (
            <TextInput
              id={id}
              value={username}
              className="font-mono"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              // Se normaliza al teclear en vez de rechazar despues: quien
              // escribe "Mei Ñu" ve como se convierte en "meinu" y entiende
              // la regla sin leer un mensaje de error.
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            />
          )}
        </Field>

        {username !== profile.username && !problem && (
          <p className="rounded-xl surface-2 px-3 py-2 text-xs ink-secondary">
            Si <span className="font-mono">{formatHandle({ username, uniqueCode: profile.uniqueCode })}</span>{" "}
            ya estuviera cogido, Voyago te dará otro número.
          </p>
        )}

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}
