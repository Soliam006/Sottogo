"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { errorMessage } from "@/lib/errors";

/**
 * Autenticacion por email + contrasena (Supabase Auth).
 * El perfil publico (Nombre#Codigo) lo crea un trigger en la base de datos.
 */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/trips";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isRegister = mode === "register";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (isRegister && name.trim().length < 2) {
      setError("Escribe tu nombre (mínimo 2 caracteres).");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const db = getSupabaseBrowserClient();

      if (isRegister) {
        const { data, error: signUpError } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setNotice("Revisa tu correo para confirmar la cuenta y vuelve a iniciar sesión.");
          return;
        }
      } else {
        const { error: signInError } = await db.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "No se ha podido completar la operación."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 15% 10%, #4f46e5 0%, transparent 55%), radial-gradient(100% 80% at 85% 90%, #f97316 0%, transparent 55%), linear-gradient(160deg, #1e1b4b, #0b0a1f)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-80">Voyago</p>
          <div>
            <h1 className="max-w-md text-4xl font-bold leading-tight">
              Vive el viaje. Organízalo. Recuérdalo para siempre.
            </h1>
            <p className="mt-4 max-w-md text-white/70">
              Gastos, lugares, fotos e itinerario conectados alrededor de una única cosa: el viaje.
            </p>
          </div>
          <p className="text-sm text-white/50">🇯🇵 Japón · 🇮🇹 Italia · 🇮🇸 Islandia · dondequiera que vayas</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-14">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold ink-primary">
              {isRegister ? "Crear cuenta" : "Bienvenido de vuelta"}
            </h2>
            <p className="mt-1 text-sm ink-muted">
              {isRegister
                ? "Te asignaremos un identificador único tipo Will#4821."
                : "Entra para seguir con tus viajes."}
            </p>
          </div>

          {isRegister && (
            <Field label="Nombre" required>
              {(id) => (
                <TextInput
                  id={id}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Will"
                  required
                />
              )}
            </Field>
          )}

          <Field label="Email" required>
            {(id) => (
              <TextInput
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="tu@email.com"
                required
              />
            )}
          </Field>

          <Field label="Contraseña" required hint={isRegister ? "Mínimo 8 caracteres." : undefined}>
            {(id) => (
              <TextInput
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
              />
            )}
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {notice}
            </p>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {isRegister ? "Crear cuenta" : "Entrar"}
          </Button>

          <p className="text-center text-sm ink-muted">
            {isRegister ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-medium text-brand-600 underline underline-offset-4"
            >
              {isRegister ? "Inicia sesión" : "Regístrate"}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
