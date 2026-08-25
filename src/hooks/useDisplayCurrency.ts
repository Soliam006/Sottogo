"use client";

import { useCallback, useEffect, useState } from "react";
import { getExchangeRate } from "@/services/api/exchange";

/**
 * Permite alternar la moneda en la que se LEEN los totales (p. ej. ver el viaje
 * a Japon en € o en ¥) sin tocar los importes almacenados.
 */
export function useDisplayCurrency(baseCurrency: string, alternative: string | null) {
  const [currency, setCurrency] = useState(baseCurrency);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(baseCurrency);
    setRate(1);
  }, [baseCurrency]);

  useEffect(() => {
    let active = true;
    if (currency === baseCurrency) {
      setRate(1);
      setError(null);
      return;
    }

    getExchangeRate(baseCurrency, currency)
      .then((value) => {
        if (active) {
          setRate(value);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError("No se ha podido obtener el tipo de cambio; se muestran importes en la moneda base.");
          setCurrency(baseCurrency);
          setRate(1);
        }
      });

    return () => {
      active = false;
    };
  }, [currency, baseCurrency]);

  const convert = useCallback((amountInBase: number) => amountInBase * rate, [rate]);

  const toggle = useCallback(() => {
    if (!alternative || alternative === baseCurrency) return;
    setCurrency((current) => (current === baseCurrency ? alternative : baseCurrency));
  }, [alternative, baseCurrency]);

  return { currency, convert, toggle, canToggle: Boolean(alternative && alternative !== baseCurrency), error };
}
