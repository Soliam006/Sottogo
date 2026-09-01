/**
 * Abstraccion de tipos de cambio.
 *
 * El modelo de datos guarda `amount` + `currency` y, opcionalmente,
 * `convertedAmount` + `exchangeRate` congelados en el momento del alta.
 * Cambiar de proveedor (BCE, API de pago, tasas manuales) solo implica
 * escribir otra implementacion de `ExchangeRateProvider`.
 */
export interface ExchangeRateProvider {
  readonly id: string;
  /** Cuantas unidades de `to` equivale 1 unidad de `from`. */
  getRate(from: string, to: string): Promise<number>;
}

/** Fallo al obtener una tasa: el proveedor no responde o no cubre el par. */
export class ExchangeRateError extends Error {}

export interface CurrencyMeta {
  code: string;
  label: string;
  symbol: string;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "Dólar estadounidense", symbol: "$" },
  { code: "MXN", label: "Peso mexicano", symbol: "MX$" },
  { code: "JPY", label: "Yen japonés", symbol: "¥" },
  { code: "KRW", label: "Won surcoreano", symbol: "₩" },
  { code: "PYG", label: "Guaraní paraguayo", symbol: "₲" },
  { code: "GBP", label: "Libra esterlina", symbol: "£" },
  { code: "CHF", label: "Franco suizo", symbol: "CHF" },
  { code: "CAD", label: "Dólar canadiense", symbol: "CA$" },
  { code: "AUD", label: "Dólar australiano", symbol: "A$" },
  { code: "BRL", label: "Real brasileño", symbol: "R$" },
  { code: "THB", label: "Baht tailandés", symbol: "฿" },
  { code: "CNY", label: "Yuan chino", symbol: "CN¥" },
  { code: "SEK", label: "Corona sueca", symbol: "kr" },
  { code: "NOK", label: "Corona noruega", symbol: "kr" },
  { code: "MAD", label: "Dírham marroquí", symbol: "MAD" },
  { code: "TRY", label: "Lira turca", symbol: "₺" },
  // Los tres pesos comparten el signo "$": se desambiguan con el prefijo, igual
  // que MX$ o CA$, para que la lista no muestre tres monedas identicas.
  { code: "ARS", label: "Peso argentino", symbol: "AR$" },
  { code: "CLP", label: "Peso chileno", symbol: "CL$" },
];

export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCIES.find((c) => c.code === code) ?? { code, label: code, symbol: code };
}
