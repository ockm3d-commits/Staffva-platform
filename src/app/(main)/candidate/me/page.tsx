"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MyProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: candidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (candidate) {
        router.replace(`/candidate/${candidate.id}`);
      } else {
        router.push("/apply");
      }
    }

    redirect();
  }, [router]);

  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-background">
      <p className="text-text/60">Loading your profile...</p>
    </main>
  );
}
