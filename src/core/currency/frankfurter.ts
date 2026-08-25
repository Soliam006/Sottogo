import type { ExchangeRateProvider } from "./types";

/**
 * Tipos de cambio del Banco Central Europeo via frankfurter.app.
 * Gratuito y sin API key. Solo se invoca desde el servidor
 * (src/app/api/exchange-rate) para poder cachear y aislar el proveedor.
 */
export class FrankfurterRateProvider implements ExchangeRateProvider {
  readonly id = "frankfurter";

  constructor(private readonly endpoint = "https://api.frankfurter.app") {}

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const url = `${this.endpoint}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 6 } });

    if (!res.ok) {
      throw new ExchangeRateError(`El proveedor de tipos de cambio respondió ${res.status}`);
    }

    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[to];

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new ExchangeRateError(`No hay tipo de cambio disponible para ${from} → ${to}`);
    }
    return rate;
  }
}

export class ExchangeRateError extends Error {}
