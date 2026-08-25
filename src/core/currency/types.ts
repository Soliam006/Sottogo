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

export interface CurrencyMeta {
  code: string;
  label: string;
  symbol: string;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "Dólar estadounidense", symbol: "$" },
  { code: "JPY", label: "Yen japonés", symbol: "¥" },
  { code: "GBP", label: "Libra esterlina", symbol: "£" },
  { code: "CHF", label: "Franco suizo", symbol: "CHF" },
  { code: "CAD", label: "Dólar canadiense", symbol: "CA$" },
  { code: "AUD", label: "Dólar australiano", symbol: "A$" },
  { code: "MXN", label: "Peso mexicano", symbol: "MX$" },
  { code: "BRL", label: "Real brasileño", symbol: "R$" },
  { code: "THB", label: "Baht tailandés", symbol: "฿" },
  { code: "KRW", label: "Won surcoreano", symbol: "₩" },
  { code: "CNY", label: "Yuan chino", symbol: "CN¥" },
  { code: "SEK", label: "Corona sueca", symbol: "kr" },
  { code: "NOK", label: "Corona noruega", symbol: "kr" },
  { code: "MAD", label: "Dírham marroquí", symbol: "MAD" },
  { code: "TRY", label: "Lira turca", symbol: "₺" },
];

export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCIES.find((c) => c.code === code) ?? { code, label: code, symbol: code };
}
