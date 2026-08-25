"use client";

import { useEffect, useRef, useState } from "react";
import { formatHandle } from "@/core/models";
import { useSession } from "@/components/providers/SessionProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Avatar } from "@/components/ui/Avatar";

export function UserMenu() {
  const { profile, signOut } = useSession();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!profile) return null;
  const handle = formatHandle(profile);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full transition-transform hover:scale-105"
      >
        <Avatar profile={profile} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 w-64 animate-rise overflow-hidden rounded-2xl border border-subtle surface-1 shadow-xl"
        >
          <div className="border-b border-subtle px-4 py-3">
            <p className="truncate text-sm font-semibold ink-primary">{profile.name}</p>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(handle);
                toast("Identificador copiado");
              }}
              className="mt-0.5 font-mono text-xs text-brand-600 hover:underline"
              title="Copiar identificador"
            >
              {handle}
            </button>
          </div>

          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide ink-muted">Tema</p>
            <div className="flex gap-1 rounded-xl surface-2 p-1">
              {(["light", "dark", "system"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setTheme(option)}
                  className={
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors " +
                    (theme === option ? "surface-1 ink-primary shadow-sm" : "ink-muted")
                  }
                >
                  {option === "light" ? "Claro" : option === "dark" ? "Oscuro" : "Auto"}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void signOut()}
            className="w-full border-t border-subtle px-4 py-3 text-left text-sm font-medium text-rose-600 transition-colors hover:surface-2 dark:text-rose-400"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
