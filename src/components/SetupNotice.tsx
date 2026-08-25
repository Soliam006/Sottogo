/**
 * Pantalla honesta de configuracion.
 * Preferimos bloquear con instrucciones claras antes que simular datos.
 */
export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Voyago</p>
      <h1 className="mt-3 text-3xl font-bold ink-primary">Falta configurar el backend</h1>
      <p className="mt-4 ink-secondary">
        La aplicación necesita un proyecto de Supabase para autenticar usuarios y guardar viajes,
        gastos y fotos. No se muestran datos simulados a propósito.
      </p>

      <ol className="mt-8 space-y-4 text-sm ink-secondary">
        <li>
          <span className="font-semibold ink-primary">1.</span> Crea un proyecto gratuito en{" "}
          <a className="text-brand-600 underline underline-offset-4" href="https://supabase.com/dashboard">
            supabase.com
          </a>
          .
        </li>
        <li>
          <span className="font-semibold ink-primary">2.</span> Ejecuta{" "}
          <code className="rounded surface-2 px-1.5 py-0.5">supabase/schema.sql</code> en el SQL Editor.
        </li>
        <li>
          <span className="font-semibold ink-primary">3.</span> Copia{" "}
          <code className="rounded surface-2 px-1.5 py-0.5">.env.example</code> a{" "}
          <code className="rounded surface-2 px-1.5 py-0.5">.env.local</code> y rellena{" "}
          <code className="rounded surface-2 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code className="rounded surface-2 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>
          <span className="font-semibold ink-primary">4.</span> Reinicia el servidor de desarrollo.
        </li>
      </ol>
    </main>
  );
}
