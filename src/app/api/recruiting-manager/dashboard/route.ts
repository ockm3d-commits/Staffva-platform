import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getManagerUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ).auth.getUser(token);
  if (!user) return null;
  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, calendar_link, daily_interview_target, recruiter_type")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "recruiting_manager") return null;
  return { user, profile };
}

export async function GET(req: NextRequest) {
  const auth = await getManagerUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, profile } = auth;
  const supabase = getAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00.000Z`;
  const todayEnd = `${today}T23:59:59.999Z`;

  // Week boundaries for metrics
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartISO = weekStart.toISOString();

  const [
    // Personal KPI
    myInterviewsRes,
    mySocialRes,
    // Team data
    allRecruitersRes,
    allSocialTodayRes,
    // Unrouted queue
    unroutedRes,
    // Approval queue
    approvalRes,
    // Ban requests
    banRes,
    // Stalled revisions (>72h)
    stalledRes,
    // All team interviews today
    teamInterviewsRes,
    // Social posts this week (for compliance grid)
    weeklyPostsRes,
    // Revision item aggregation
    allRevisionsRes,
    // Candidates for pipeline velocity
    approvedThisWeekRes,
  ] = await Promise.all([
    // My interviews today
    supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("assigned_recruiter", user.id)
      .eq("second_interview_status", "completed")
      .gte("second_interview_completed_at", todayStart)
      .lte("second_interview_completed_at", todayEnd),
    // My social posts
    supabase
      .from("social_posts")
      .select("id, post_url, created_at")
      .eq("recruiter_id", user.id)
      .eq("post_date", today),
    // All recruiters
    supabase
      .from("profiles")
      .select("id, full_name, role, calendar_link, daily_interview_target, recruiter_type")
      .in("role", ["recruiter", "recruiting_manager"])
      .order("full_name"),
    // All social posts today
    supabase
      .from("social_posts")
      .select("recruiter_id, post_url")
      .eq("post_date", today),
    // Unrouted candidates
    supabase
      .from("candidates")
      .select("id, display_name, full_name, role_category, role_category_custom, profile_photo_url, screening_score, english_mc_score, created_at, english_written_tier")
      .eq("role_category", "Other")
      .is("assigned_recruiter", null)
      .order("created_at", { ascending: true }),
    // Approval queue
    supabase
      .from("candidates")
      .select("id, display_name, full_name, role_category, profile_photo_url, screening_score, second_interview_completed_at, admin_status, assigned_recruiter, tagline, bio, resume_url, payout_method, id_verification_status, voice_recording_1_url, voice_recording_2_url, english_mc_score, recruiter_ai_score_results, video_intro_url, id_verification_consent, profile_photo_url")
      .eq("admin_status", "pending_speaking_review")
      .order("created_at", { ascending: true }),
    // Ban requests
    supabase
      .from("candidates")
      .select("id, display_name, full_name, role_category, ban_reason, ban_requested_by, ban_requested_at, ban_pending_review")
      .eq("ban_pending_review", true),
    // Stalled revisions (>72h)
    supabase
      .from("profile_revisions")
      .select("id, candidate_id, items, status, created_at, candidates!inner(id, display_name, full_name, role_category, profile_photo_url, assigned_recruiter)")
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()),
    // All team interviews today
    supabase
      .from("candidates")
      .select("assigned_recruiter", { count: "exact" })
      .eq("second_interview_status", "completed")
      .gte("second_interview_completed_at", todayStart)
      .lte("second_interview_completed_at", todayEnd),
    // Weekly social posts (for compliance grid)
    supabase
      .from("social_posts")
      .select("recruiter_id, post_date, post_url")
      .gte("post_date", weekStart.toISOString().split("T")[0]),
    // All revisions for top items analysis
    supabase
      .from("profile_revisions")
      .select("items, created_at")
      .gte("created_at", weekStartISO),
    // Approved this week
    supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("admin_status", "approved")
      .gte("updated_at", weekStartISO),
  ]);

  // Process team status
  const recruiters = allRecruitersRes.data || [];
  const socialToday = allSocialTodayRes.data || [];
  const socialByRecruiter = new Map<string, number>();
  for (const p of socialToday) {
    socialByRecruiter.set(p.recruiter_id, (socialByRecruiter.get(p.recruiter_id) || 0) + 1);
  }

  // Count interviews per recruiter today
  const teamInterviews = teamInterviewsRes.data || [];
  const interviewsByRecruiter = new Map<string, number>();
  for (const c of teamInterviews) {
    if (c.assigned_recruiter) {
      interviewsByRecruiter.set(c.assigned_recruiter, (interviewsByRecruiter.get(c.assigned_recruiter) || 0) + 1);
    }
  }

  // Get queue depth per recruiter
  const { data: queueCounts } = await supabase
    .from("candidates")
    .select("assigned_recruiter")
    .not("assigned_recruiter", "is", null)
    .not("admin_status", "in", '("approved","deactivated","rejected")');

  const queueByRecruiter = new Map<string, number>();
  for (const c of queueCounts || []) {
    if (c.assigned_recruiter) {
      queueByRecruiter.set(c.assigned_recruiter, (queueByRecruiter.get(c.assigned_recruiter) || 0) + 1);
    }
  }

  const teamStatus = recruiters.map((r) => ({
    id: r.id,
    name: r.full_name,
    role: r.role,
    interviewsToday: interviewsByRecruiter.get(r.id) || 0,
    dailyTarget: r.daily_interview_target,
    socialPostsToday: socialByRecruiter.get(r.id) || 0,
    queueDepth: queueByRecruiter.get(r.id) || 0,
    calendarLink: r.calendar_link,
    calendarValid: !!r.calendar_link,
  }));

  // Team totals
  const totalTeamTarget = recruiters.reduce((s, r) => s + (r.daily_interview_target || 0), 0);
  const totalTeamInterviews = teamInterviews.length;
  const recruitersAt2Posts = recruiters.filter((r) => (socialByRecruiter.get(r.id) || 0) >= 2).length;

  // Approval queue enrichment — map recruiter names
  const recruiterNameMap = new Map<string, string>();
  for (const r of recruiters) recruiterNameMap.set(r.id, r.full_name);

  const approvalQueue = (approvalRes.data || []).map((c) => ({
    ...c,
    assigned_recruiter_name: c.assigned_recruiter ? recruiterNameMap.get(c.assigned_recruiter) || "Unknown" : "Unassigned",
  }));

  // Ban requests enrichment
  const banQueue = (banRes.data || []).map((c) => ({
    ...c,
    ban_requested_by_name: c.ban_requested_by ? recruiterNameMap.get(c.ban_requested_by) || "Unknown" : "Unknown",
  }));

  // Pipeline velocity: top revision items
  const revisionItemCounts = new Map<string, number>();
  for (const rev of allRevisionsRes.data || []) {
    for (const item of (rev.items as { type: string }[])) {
      const shortType = item.type.split(" — ")[0];
      revisionItemCounts.set(shortType, (revisionItemCounts.get(shortType) || 0) + 1);
    }
  }
  const topRevisionItems = Array.from(revisionItemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  // Weekly posting compliance grid
  const weeklyPosts = weeklyPostsRes.data || [];
  const postingGrid = new Map<string, Map<string, number>>();
  for (const p of weeklyPosts) {
    if (!postingGrid.has(p.recruiter_id)) postingGrid.set(p.recruiter_id, new Map());
    const dayMap = postingGrid.get(p.recruiter_id)!;
    dayMap.set(p.post_date, (dayMap.get(p.post_date) || 0) + 1);
  }

  // Build grid rows
  const gridDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    gridDays.push(d.toISOString().split("T")[0]);
  }

  const complianceGrid = recruiters.map((r) => {
    const dayMap = postingGrid.get(r.id) || new Map();
    return {
      recruiterId: r.id,
      recruiterName: r.full_name,
      days: gridDays.map((day) => ({ date: day, count: dayMap.get(day) || 0 })),
    };
  });

  return NextResponse.json({
    personalKpi: {
      interviewsToday: myInterviewsRes.count ?? 0,
      dailyTarget: profile.daily_interview_target,
      recruiterType: profile.recruiter_type,
      socialPosts: mySocialRes.data || [],
      calendarLink: profile.calendar_link || null,
      calendarValid: !!profile.calendar_link,
    },
    teamSummary: {
      totalInterviewsToday: totalTeamInterviews,
      totalTarget: totalTeamTarget,
      postingCompliance: { at2Posts: recruitersAt2Posts, totalRecruiters: recruiters.length },
      approvalQueueCount: approvalQueue.length,
    },
    teamStatus,
    unroutedQueue: unroutedRes.data || [],
    approvalQueue,
    banQueue,
    stalledRevisions: stalledRes.data || [],
    metrics: {
      approvedThisWeek: approvedThisWeekRes.count ?? 0,
      topRevisionItems,
      weeklyPostingCompliance: Math.round((recruitersAt2Posts / Math.max(recruiters.length, 1)) * 100),
    },
    complianceGrid,
    gridDays,
    recruiterNameMap: Object.fromEntries(recruiterNameMap),
  });
}
