export * from "./types";
export * from "./frankfurter";

/** Redondeo al numero de decimales habitual de la divisa. */
export function roundForCurrency(amount: number, currency: string): number {
  const zeroDecimal = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);
  const factor = zeroDecimal.has(currency) ? 1 : 100;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}
