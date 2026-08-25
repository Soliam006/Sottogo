import { currencyMeta } from "@/core/currency";

const LOCALE = "es-ES";

export function formatMoney(amount: number, currency: string, options: { compact?: boolean } = {}): string {
  const zeroDecimal = ["JPY", "KRW", "VND", "CLP", "ISK"].includes(currency);
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: zeroDecimal ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
      notation: options.compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${amount.toFixed(zeroDecimal ? 0 : 2)} ${currencyMeta(currency).symbol}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatDate(iso: string, style: "short" | "long" | "day" = "short"): string {
  const date = parseISODate(iso);
  if (!date) return iso;

  if (style === "long") {
    return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" }).format(date);
  }
  if (style === "day") {
    return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" }).format(date);
  }
  return new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateRange(start: string, end: string): string {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (!a || !b) return `${start} → ${end}`;

  const sameYear = a.getFullYear() === b.getFullYear();
  const left = new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(a);
  const right = new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(b);

  return `${left} → ${right}`;
}

/** "12 mar, 08:45" — para salidas, llegadas, check-in… */
export function formatDateTime(iso: string | null): string {
  const date = parseISODate(iso ?? "");
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

export function parseISODate(iso: string): Date | null {
  if (!iso) return null;
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayISO(): string {
  return toLocalISODate(new Date());
}

export function daysBetween(start: string, end: string): number {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

/** Lista de fechas ISO entre dos extremos, ambos incluidos. */
export function dateRange(start: string, end: string): string[] {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (!a || !b || b < a) return [];

  const days: string[] = [];
  const cursor = new Date(a);
  while (cursor <= b) {
    days.push(toLocalISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Fecha local en formato YYYY-MM-DD (sin el desfase de toISOString). */
export function toLocalISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Bandera emoji a partir del codigo ISO de pais (ej. "JP" -> 🇯🇵). */
export function flagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65),
  );
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
