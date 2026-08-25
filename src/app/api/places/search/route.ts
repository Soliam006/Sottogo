import { NextResponse, type NextRequest } from "next/server";
import { getPlacesProvider } from "@/core/places";
import { PlacesProviderError } from "@/core/places/types";
import { getSupabaseServerClient } from "@/services/supabase/server";

/**
 * Busqueda de lugares reales. Se ejecuta en el servidor para que las API keys
 * del proveedor nunca lleguen al navegador y para poder cachear/limitar.
 */
export async function GET(request: NextRequest) {
  const db = await getSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim();
  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const bias =
    Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
      ? { latitude: lat, longitude: lng }
      : undefined;

  try {
    const results = await getPlacesProvider().search({ query, bias, limit: 8 });
    return NextResponse.json({ results });
  } catch (error) {
    // El motivo real (400 por idioma, rate limit...) solo debe verse en el servidor.
    console.error("[places/search]", error);
    const status = error instanceof PlacesProviderError ? error.status : 502;
    return NextResponse.json(
      { error: "El servicio de lugares no está disponible ahora mismo." },
      { status },
    );
  }
}
