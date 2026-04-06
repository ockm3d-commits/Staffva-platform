import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verifies that the candidate belongs to one of the recruiter's assigned
 * role categories. Returns a { error, status } object on failure, or null
 * if the scope check passes. Admin callers should bypass this entirely.
 */
export async function assertRecruiterScope(
  recruiterId: string,
  candidateId: string
): Promise<{ error: string; status: number } | null> {
  const supabase = getAdminClient();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("role_category")
    .eq("id", candidateId)
    .single();

  if (!candidate) {
    return { error: "Candidate not found", status: 404 };
  }

  const { data: assignments } = await supabase
    .from("recruiter_assignments")
    .select("role_category")
    .eq("recruiter_id", recruiterId);

  const assignedCategories = (assignments ?? []).map((a) => a.role_category);

  if (!assignedCategories.includes(candidate.role_category)) {
    return { error: "Forbidden: candidate is not in your assigned categories", status: 403 };
  }

  return null;
}
