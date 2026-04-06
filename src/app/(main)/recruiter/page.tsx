"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Candidate {
  id: string;
  full_name: string;
  display_name: string;
  email: string;
  country: string;
  role_category: string;
  hourly_rate: number;
  english_written_tier: string;
  speaking_level: string;
  screening_tag: string;
  screening_score: number;
  admin_status: string;
  profile_photo_url: string | null;
  created_at: string;
  waiting_since: string | null;
  second_interview_status: string;
  second_interview_scheduled_at: string | null;
  assigned_recruiter: string | null;
  assignment_pending_review: boolean;
  sla_status: "green" | "yellow" | "red";
  wait_hours: number;
}

interface RecruiterOption {
  id: string;
  full_name: string;
}

interface MessageThread {
  candidate_id: string;
  candidate_name: string;
  candidate_photo: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface ThreadMessage {
  id: string;
  sender_role: "recruiter" | "candidate";
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Workload {
  total: number;
  pending_second: number;
  scheduled: number;
  completed_this_week: number;
  avg_wait_hours: number;
  red_count: number;
  yellow_count: number;
  green_count: number;
}

const SLA_COLORS = {
  green: { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-700" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-500", text: "text-yellow-700" },
  red: { bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", text: "text-red-700" },
};

const SCREENING_COLORS: Record<string, string> = {
  Priority: "bg-green-100 text-green-700",
  Review: "bg-yellow-100 text-yellow-700",
  Hold: "bg-gray-100 text-gray-600",
};

export default function RecruiterDashboardPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleModal, setScheduleModal] = useState<{ candidateId: string; name: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [calendarLink, setCalendarLink] = useState("");
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarSaved, setCalendarSaved] = useState(false);
  const [messageThreads, setMessageThreads] = useState<MessageThread[]>([]);
  const [activeThread, setActiveThread] = useState<{ candidateId: string; candidateName: string } | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reassignModal, setReassignModal] = useState<{ candidateId: string; name: string } | null>(null);
  const [recruiters, setRecruiters] = useState<RecruiterOption[]>([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState("");
  const [reassigning, setReassigning] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/recruiter/queue?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 403) { router.push("/"); return; }
      if (!res.ok) { setLoading(false); return; }

      const data = await res.json();
      setCandidates(data.candidates || []);
      setWorkload(data.workload || null);

      // Load calendar link
      const { data: profile } = await supabase
        .from("profiles")
        .select("calendar_link")
        .eq("id", session.user.id)
        .single();
      if (profile?.calendar_link) setCalendarLink(profile.calendar_link);

      // Load all recruiters for the reassign dropdown
      const { data: recruiterProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "recruiter")
        .order("full_name");
      if (recruiterProfiles) setRecruiters(recruiterProfiles);

      // Load message threads — get all recruiter_messages for this recruiter, grouped by candidate
      const { data: msgs } = await supabase
        .from("recruiter_messages")
        .select("candidate_id, sender_role, body, created_at, read_at")
        .eq("recruiter_id", session.user.id)
        .order("created_at", { ascending: false });

      if (msgs && msgs.length > 0) {
        // Group by candidate_id
        const threadMap = new Map<string, { msgs: typeof msgs }>();
        for (const m of msgs) {
          if (!threadMap.has(m.candidate_id)) threadMap.set(m.candidate_id, { msgs: [] });
          threadMap.get(m.candidate_id)!.msgs.push(m);
        }

        // Build thread summaries
        const threads: MessageThread[] = [];
        for (const [cId, { msgs: cMsgs }] of threadMap) {
          const latest = cMsgs[0]; // already sorted desc
          const unread = cMsgs.filter((m) => m.sender_role === "candidate" && !m.read_at).length;
          // Find candidate name from the candidates list
          const cand = (data.candidates || []).find((c: Candidate) => c.id === cId);
          threads.push({
            candidate_id: cId,
            candidate_name: cand?.display_name || cand?.full_name || "Candidate",
            candidate_photo: cand?.profile_photo_url || null,
            last_message: latest.body,
            last_message_at: latest.created_at,
            unread_count: unread,
          });
        }
        // Sort by most recent message
        threads.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        setMessageThreads(threads);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [statusFilter, router]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  async function handleSchedule() {
    if (!scheduleModal || !scheduleDate || !scheduleTime) return;
    setScheduling(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch("/api/recruiter/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ candidateId: scheduleModal.candidateId, scheduledDate: scheduleDate, scheduledTime: scheduleTime }),
    });

    setScheduleModal(null);
    setScheduleDate("");
    setScheduleTime("");
    setScheduling(false);
    loadQueue();
  }

  async function handleSaveCalendar() {
    setCalendarSaving(true);
    setCalendarSaved(false);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from("profiles")
      .update({ calendar_link: calendarLink.trim() || null })
      .eq("id", session.user.id);

    setCalendarSaving(false);
    setCalendarSaved(true);
    setTimeout(() => setCalendarSaved(false), 2000);
  }

  async function handleReassign() {
    if (!reassignModal || !selectedRecruiterId) return;
    setReassigning(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch("/api/recruiter/reassign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ candidateId: reassignModal.candidateId, newRecruiterId: selectedRecruiterId }),
    });

    setReassignModal(null);
    setSelectedRecruiterId("");
    setReassigning(false);
    loadQueue();
  }

  async function openThread(candidateId: string, candidateName: string) {
    setActiveThread({ candidateId, candidateName });
    setThreadLoading(true);
    setThreadMessages([]);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/recruiter-messages?candidateId=${candidateId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setThreadMessages(data.messages || []);
    }
    setThreadLoading(false);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !activeThread || sendingMessage) return;
    setSendingMessage(true);

    const res = await fetch("/api/recruiter-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: activeThread.candidateId, body: newMessage.trim() }),
    });

    if (res.ok) {
      setNewMessage("");
      // Reload thread
      await openThread(activeThread.candidateId, activeThread.candidateName);
    }
    setSendingMessage(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FE6E3E] border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1C1B1A]">Recruiter Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Priority queue — longest waiting candidates first</p>

      {/* Workload summary bar */}
      {workload && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-[#1C1B1A]">{workload.total}</p>
            <p className="text-[10px] text-gray-500 font-medium uppercase">Total Assigned</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-[#FE6E3E]">{workload.pending_second}</p>
            <p className="text-[10px] text-gray-500 font-medium uppercase">Pending Interview</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{workload.scheduled}</p>
            <p className="text-[10px] text-gray-500 font-medium uppercase">Scheduled</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-green-600">{workload.completed_this_week}</p>
            <p className="text-[10px] text-gray-500 font-medium uppercase">Completed (Week)</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-[#1C1B1A]">{workload.avg_wait_hours}h</p>
            <p className="text-[10px] text-gray-500 font-medium uppercase">Avg Wait</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />{workload.red_count}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" />{workload.yellow_count}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{workload.green_count}</span>
            </div>
            <p className="text-[10px] text-gray-500 font-medium uppercase mt-1">SLA Status</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex gap-2">
        {["all", "pending_speaking_review", "approved", "revision_required"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s ? "bg-[#FE6E3E] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Priority queue */}
      {candidates.length === 0 ? (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No candidates in your queue.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {candidates.map((c) => {
            const sla = SLA_COLORS[c.sla_status];
            const isPending = c.assignment_pending_review;

            return (
              <div
                key={c.id}
                className={`rounded-lg border p-4 transition-colors ${
                  isPending
                    ? "border-orange-300 bg-orange-50"
                    : `${sla.border} ${sla.bg}`
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* SLA dot or pending indicator */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    {isPending ? (
                      <span className="h-3 w-3 rounded-full bg-orange-400" />
                    ) : (
                      <>
                        <span className={`h-3 w-3 rounded-full ${sla.dot}`} />
                        <span className={`text-[9px] font-medium ${sla.text}`}>{c.wait_hours}h</span>
                      </>
                    )}
                  </div>

                  {/* Photo */}
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                    {c.profile_photo_url ? (
                      <img src={c.profile_photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                        {c.display_name?.[0] || "?"}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-[#1C1B1A] text-sm">{c.display_name || c.full_name}</p>
                        <p className="text-xs text-gray-500">{c.country} · {c.role_category} · ${c.hourly_rate?.toLocaleString()}/hr</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isPending && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 border border-orange-300">
                            Needs Routing
                          </span>
                        )}
                        {c.screening_tag && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SCREENING_COLORS[c.screening_tag] || "bg-gray-100 text-gray-600"}`}>
                            {c.screening_tag} {c.screening_score}/10
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.admin_status === "approved" ? "bg-green-100 text-green-700" :
                          c.admin_status === "pending_speaking_review" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {c.admin_status?.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {/* Interview status */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      {c.second_interview_status === "scheduled" && c.second_interview_scheduled_at && (
                        <span className="text-[11px] text-blue-600 font-medium">
                          Interview: {new Date(c.second_interview_scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {c.second_interview_status === "completed" && (
                        <span className="text-[11px] text-green-600 font-medium">Interview complete</span>
                      )}

                      {/* Actions */}
                      <div className="ml-auto flex gap-2 flex-wrap">
                        <Link
                          href={`/candidate/${c.id}`}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[#1C1B1A] hover:border-[#FE6E3E] hover:text-[#FE6E3E] transition-colors"
                        >
                          View Profile
                        </Link>
                        <button
                          onClick={() => openThread(c.id, c.display_name || c.full_name)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[#1C1B1A] hover:border-[#FE6E3E] hover:text-[#FE6E3E] transition-colors"
                        >
                          Message
                        </button>
                        {isPending && (
                          <button
                            onClick={() => { setReassignModal({ candidateId: c.id, name: c.display_name || c.full_name }); setSelectedRecruiterId(""); }}
                            className="rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-600 transition-colors"
                          >
                            Reassign
                          </button>
                        )}
                        {!isPending && c.second_interview_status !== "scheduled" && c.second_interview_status !== "completed" && (
                          <button
                            onClick={() => setScheduleModal({ candidateId: c.id, name: c.display_name || c.full_name })}
                            className="rounded-lg bg-[#FE6E3E] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#E55A2B] transition-colors"
                          >
                            Schedule Interview
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar Link Editor */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Calendar Booking Link</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500 mb-3">Paste your Google Calendar scheduling link. Candidates will use this to book their second interview.</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={calendarLink}
              onChange={(e) => setCalendarLink(e.target.value)}
              placeholder="https://calendar.google.com/calendar/appointments/..."
              className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
            />
            <button
              onClick={handleSaveCalendar}
              disabled={calendarSaving}
              className="shrink-0 rounded-lg bg-[#FE6E3E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors disabled:opacity-50"
            >
              {calendarSaving ? "Saving..." : calendarSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Message Inbox */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Message Inbox</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          {messageThreads.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">No messages yet. Use the Message button on a candidate to start a conversation.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {messageThreads.map((thread) => (
                <button
                  key={thread.candidate_id}
                  onClick={() => openThread(thread.candidate_id, thread.candidate_name)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                    {thread.candidate_photo ? (
                      <img src={thread.candidate_photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                        {thread.candidate_name?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1C1B1A] truncate">{thread.candidate_name}</p>
                      <p className="text-[10px] text-gray-400 shrink-0 ml-2">
                        {new Date(thread.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{thread.last_message}</p>
                  </div>
                  {thread.unread_count > 0 && (
                    <span className="shrink-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FE6E3E] px-1.5 text-[10px] font-bold text-white">
                      {thread.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message Thread Modal */}
      {activeThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActiveThread(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl flex flex-col" style={{ height: "70vh" }} onClick={(e) => e.stopPropagation()}>
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-3">
              <button onClick={() => setActiveThread(null)} className="rounded-lg p-1 hover:bg-gray-100">
                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="text-sm font-semibold text-[#1C1B1A]">{activeThread.candidateName}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FE6E3E] border-t-transparent" />
                </div>
              ) : threadMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400">No messages yet. Send the first message.</p>
                </div>
              ) : (
                threadMessages.map((msg) => {
                  const isMe = msg.sender_role === "recruiter";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-[#FE6E3E] text-white" : "bg-gray-100 text-[#1C1B1A]"}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <p className={`mt-1 text-[10px] ${isMe ? "text-white/60" : "text-gray-400"}`}>
                          {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-3 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendingMessage}
                className="shrink-0 rounded-full bg-[#FE6E3E] p-2.5 text-white hover:bg-[#E55A2B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Read-only notice */}
      <div className="mt-6 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-500">
          <strong>Recruiter access.</strong> You can view profiles, schedule interviews, and send calendar invites.
          Approval actions are managed by the admin team.
        </p>
      </div>

      {/* Reassign modal */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReassignModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1C1B1A]">Reassign Candidate</h2>
            <p className="mt-1 text-sm text-gray-500">Route <strong>{reassignModal.name}</strong> to a recruiter.</p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-[#1C1B1A] mb-1">Select Recruiter</label>
              <select
                value={selectedRecruiterId}
                onChange={(e) => setSelectedRecruiterId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Choose a recruiter...</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setReassignModal(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={reassigning || !selectedRecruiterId}
                className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {reassigning ? "Routing..." : "Confirm Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule interview modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setScheduleModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1C1B1A]">Schedule Interview</h2>
            <p className="mt-1 text-sm text-gray-500">Schedule a second interview with {scheduleModal.name}</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#1C1B1A]">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1B1A]">Time (UTC)</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setScheduleModal(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSchedule}
                disabled={scheduling || !scheduleDate || !scheduleTime}
                className="flex-1 rounded-lg bg-[#FE6E3E] py-2.5 text-sm font-semibold text-white hover:bg-[#E55A2B] disabled:opacity-50"
              >
                {scheduling ? "Scheduling..." : "Schedule & Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
