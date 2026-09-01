import { FrankfurterRateProvider } from "./frankfurter";
import { OpenErApiRateProvider } from "./erapi";
import { ExchangeRateError, type ExchangeRateProvider } from "./types";

/**
 * Encadena proveedores: gana el primero que sepa responder.
 *
 * No es un mecanismo de alta disponibilidad, es de COBERTURA. Cada fuente
 * publica un conjunto distinto de divisas, y ninguna las tiene todas con la
 * misma autoridad: el BCE es la referencia oficial para el euro pero ignora
 * media America Latina.
 */
export class FallbackRateProvider implements ExchangeRateProvider {
  readonly id: string;

  constructor(private readonly providers: readonly ExchangeRateProvider[]) {
    this.id = providers.map((p) => p.id).join("+");
  }

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    let lastError: unknown = null;
    for (const provider of this.providers) {
      try {
        return await provider.getRate(from, to);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ExchangeRateError(`No hay tipo de cambio disponible para ${from} → ${to}`);
  }
}

let cached: ExchangeRateProvider | null = null;

/**
 * Factoria del proveedor de tipos de cambio. SOLO servidor: lee una variable
 * sin `NEXT_PUBLIC_`, igual que `getPlacesProvider()`.
 *
 * `EXCHANGE_RATE_PROVIDER`:
 *   auto (por defecto) -> BCE y, para lo que el BCE no cubre, exchangerate-api
 *   frankfurter        -> solo BCE
 *   erapi              -> solo exchangerate-api
 *
 * El modo `auto` se eligio como predeterminado para que las divisas que ya
 * funcionaban sigan usando exactamente la misma fuente que antes —la oficial—
 * y solo las que no tenian cambio pasen por la segunda.
 */
export function getExchangeRateProvider(): ExchangeRateProvider {
  if (cached) return cached;

  const choice = (process.env.EXCHANGE_RATE_PROVIDER ?? "auto").toLowerCase();
  if (choice === "frankfurter") {
    cached = new FrankfurterRateProvider();
  } else if (choice === "erapi") {
    cached = new OpenErApiRateProvider();
  } else {
    cached = new FallbackRateProvider([
      new FrankfurterRateProvider(),
      new OpenErApiRateProvider(),
    ]);
  }

  return cached;
}
