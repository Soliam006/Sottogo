import { NextResponse, type NextRequest } from "next/server";
import { getExchangeRateProvider } from "@/core/currency";
import { getSupabaseServerClient } from "@/services/supabase/server";

const CODE = /^[A-Z]{3}$/;

/** Tipo de cambio del dia. Proveedor intercambiable (ver src/core/currency). */
export async function GET(request: NextRequest) {
  const db = await getSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const from = (request.nextUrl.searchParams.get("from") ?? "").toUpperCase();
  const to = (request.nextUrl.searchParams.get("to") ?? "").toUpperCase();

  if (!CODE.test(from) || !CODE.test(to)) {
    return NextResponse.json({ error: "Divisa no válida" }, { status: 400 });
  }

  const provider = getExchangeRateProvider();

  try {
    const rate = await provider.getRate(from, to);
    return NextResponse.json({ from, to, rate });
  } catch (error) {
    // El motivo real solo debe verse en el servidor, pero DEBE verse: sin esto,
    // un 502 no distingue "el BCE no publica esa divisa" de "la API esta caida"
    // o "EXCHANGE_RATE_PROVIDER esta fijado a un proveedor que no la cubre".
    console.error(`[exchange-rate] ${provider.id} · ${from}→${to}`, error);
    return NextResponse.json(
      { error: `No hay tipo de cambio disponible para ${from} → ${to}.` },
      { status: 502 },
    );
  }
}
