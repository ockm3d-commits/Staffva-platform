import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/apply", "/inbox", "/admin", "/team", "/hire", "/candidate/dashboard"];

// Routes only for unauthenticated users
const authRoutes = ["/login", "/signup"];

function dashboardForRole(role: string | undefined): string | null {
  if (role === "candidate") return "/candidate/dashboard";
  if (role === "client") return "/browse";
  if (role === "admin") return "/admin";
  if (role === "recruiter" || role === "recruiting_manager") return "/recruiter";
  return null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users away from protected routes
  if (!user && protectedRoutes.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages and the landing page
  if (user && (authRoutes.some((route) => pathname.startsWith(route)) || pathname === "/")) {
    const role = user.user_metadata?.role;
    const dest = dashboardForRole(role);
    if (dest) {
      const url = request.nextUrl.clone();
      url.pathname = dest;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
