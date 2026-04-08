import { createClient } from "@/lib/supabase/server";

export const revalidate = 300; // cache landing page for 5 minutes
import AnnouncementBar from "@/components/landing/AnnouncementBar";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import CommonSearchesSection from "@/components/landing/CommonSearchesSection";
import BrowseByRoleSection from "@/components/landing/BrowseByRoleSection";
import LiveCandidatesSection from "@/components/landing/LiveCandidatesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import WhyStaffVASection from "@/components/landing/WhyStaffVASection";
import ForCandidatesSection from "@/components/landing/ForCandidatesSection";
import FinalCTASection from "@/components/landing/FinalCTASection";
import Footer from "@/components/landing/Footer";
import QuickMatchButton from "@/components/landing/QuickMatchButton";
import StatsStripSection from "@/components/landing/StatsStripSection";
import MatchCTASection from "@/components/landing/MatchCTASection";

export default async function Home() {
  const supabase = await createClient();

  // Auth redirect is handled by middleware — no getUser() needed here.
  // Fetch approved available candidates for the live section.
  const { data: candidates } = await supabase
    .from("candidates")
    .select(
      "id, display_name, country, role_category, hourly_rate, english_written_tier, speaking_level, availability_status, total_earnings_usd, lock_status, profile_photo_url"
    )
    .eq("admin_status", "approved")
    .eq("availability_status", "available_now")
    .neq("lock_status", "locked")
    .order("created_at", { ascending: false })
    .limit(6);

  const liveCandidates = candidates || [];
  const heroPreview = liveCandidates.slice(0, 3);

  return (
    <main className="overflow-x-hidden">
      <LandingNavbar />
      <HeroSection heroPreview={heroPreview} />
      <StatsStripSection />
      <LiveCandidatesSection candidates={liveCandidates} />
      <HowItWorksSection />
      <WhyStaffVASection />
      <ForCandidatesSection totalApproved={0} uniqueCountries={0} />
      <FinalCTASection />
      <MatchCTASection />
      <Footer />
    </main>
  );
}
