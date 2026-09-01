export * from "./types";
export * from "./frankfurter";
export * from "./erapi";
export * from "./provider";

/**
 * Decimales de una divisa.
 *
 * Lo sabe `Intl`, que lleva la tabla de CLDR: el guarani, el yen y el peso
 * chileno no tienen fraccion; el euro y el peso argentino, si.
 *
 * Antes esto era una lista escrita a mano (`["JPY","KRW","VND","CLP","ISK"]`)
 * duplicada ademas en `lib/format`. Cualquier divisa nueva nacia rota: se
 * anadia a `CURRENCIES` y seguia mostrandose con centimos porque nadie se
 * acordaba de tocar las dos listas. Delegar en `Intl` quita ese paso.
 */
const decimalsCache = new Map<string, number>();

export function currencyDecimals(currency: string): number {
  const cached = decimalsCache.get(currency);
  if (cached !== undefined) return cached;

  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency })
        .resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // Codigo desconocido para el runtime: se asume la convencion mayoritaria.
  }

  decimalsCache.set(currency, digits);
  return digits;
}

/** Unidad minima indivisible: 1 guarani, 0,01 euros. */
export function minorUnit(currency: string): number {
  return 1 / 10 ** currencyDecimals(currency);
}

/** Redondeo al numero de decimales habitual de la divisa. */
export function roundForCurrency(amount: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}
