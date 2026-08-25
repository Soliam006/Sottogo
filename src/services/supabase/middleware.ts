import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresca la sesion en cada navegacion y protege las rutas privadas.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Las rutas de API responden 401 por si mismas: nunca redirigir un fetch.
  if (path.startsWith("/api/")) return response;

  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/auth") ||
    path.startsWith("/setup");

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && (path === "/login" || path === "/register")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/trips";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}
