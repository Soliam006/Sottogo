import { ExchangeRateError, type ExchangeRateProvider } from "./types";

/**
 * Tipos de cambio de exchangerate-api.com (endpoint abierto, sin API key).
 *
 * Existe por un motivo concreto: el BCE —y por tanto Frankfurter— publica una
 * treintena de divisas, y el guarani no esta entre ellas. Este cubre 160+,
 * incluidas PYG, ARS, CLP y MAD, que la aplicacion ofrece en su selector.
 *
 * Se actualiza una vez al dia. Para repartir la cena de un viaje sobra; no
 * sirve para operar en mercados, que no es lo que hace Voyago.
 */
export class OpenErApiRateProvider implements ExchangeRateProvider {
  readonly id = "erapi";

  constructor(private readonly endpoint = "https://open.er-api.com/v6/latest") {}

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const rate = (await this.ratesFor(from))[to];
    if (!isPositiveRate(rate)) {
      throw new ExchangeRateError(`No hay tipo de cambio disponible para ${from} → ${to}`);
    }
    if (rate >= 1) return rate;

    /*
     * La API redondea las tasas a seis decimales, asi que la direccion
     * "pequena" pierde precision: 1 ₲ = 0,000145 € descarta un 0,1 %, que en un
     * viaje de 5.000.000 ₲ son 70 centimos. Cuando toca esa direccion se pide la
     * contraria (1 € = 6.889,912508 ₲) y se invierte, que sale exacta.
     *
     * Si la segunda consulta falla, el valor directo sigue siendo utilizable:
     * mejor una tasa con un 0,1 % de error que ninguna.
     */
    try {
      const inverse = (await this.ratesFor(to))[from];
      if (isPositiveRate(inverse)) return 1 / inverse;
    } catch {
      /* se usa la tasa directa */
    }
    return rate;
  }

  private async ratesFor(base: string): Promise<Record<string, number>> {
    const res = await fetch(`${this.endpoint}/${encodeURIComponent(base)}`, {
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!res.ok) {
      throw new ExchangeRateError(`El proveedor de tipos de cambio respondió ${res.status}`);
    }

    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };

    // Esta API devuelve 200 con `result: "error"` cuando no conoce la divisa.
    if (data.result !== "success" || !data.rates) {
      throw new ExchangeRateError(`El proveedor de tipos de cambio no reconoce ${base}`);
    }
    return data.rates;
  }
}

function isPositiveRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
