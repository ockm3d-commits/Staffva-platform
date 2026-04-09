import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run session middleware only on page routes — NOT on API routes.
     * API routes authenticate via their own Bearer token / cookie checks.
     * Excluding /api/ eliminates a getUser() DB round-trip on every
     * client-side fetch (including polling intervals in Conversation.tsx etc.)
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
