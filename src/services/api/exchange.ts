"use client";

interface CacheEntry {
  rate: number;
  fetchedAt: number;
}

const TTL = 1000 * 60 * 60 * 6;
const memory = new Map<string, CacheEntry>();

/**
 * Tipo de cambio `from` -> `to`, cacheado en memoria.
 * Cambiar de fuente solo afecta a /api/exchange-rate.
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const key = `${from}:${to}`;
  const cached = memory.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL) return cached.rate;

  const res = await fetch(`/api/exchange-rate?from=${from}&to=${to}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "No se ha podido obtener el tipo de cambio.");
  }

  const data = (await res.json()) as { rate: number };
  memory.set(key, { rate: data.rate, fetchedAt: Date.now() });
  return data.rate;
}
