import { NextResponse, type NextRequest } from "next/server";
import { getPlacesProvider } from "@/core/places";
import { getSupabaseServerClient } from "@/services/supabase/server";

/** Geocodificacion inversa: coordenadas -> lugar real. */
export async function GET(request: NextRequest) {
  const db = await getSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordenadas no válidas" }, { status: 400 });
  }

  try {
    const result = await getPlacesProvider().reverse(lat, lng);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[places/reverse]", error);
    return NextResponse.json({ result: null });
  }
}
