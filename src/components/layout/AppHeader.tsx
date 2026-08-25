"use client";

import Link from "next/link";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-subtle surface-1-blur backdrop-blur">
      <div className="mx-auto flex h-[var(--app-header-h)] max-w-6xl items-center justify-between gap-3 px-5 sm:px-6">
        <Link href="/trips" className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🧭</span>
          <span className="text-sm font-bold uppercase tracking-[0.18em] ink-primary">Voyago</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <NotificationsBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
