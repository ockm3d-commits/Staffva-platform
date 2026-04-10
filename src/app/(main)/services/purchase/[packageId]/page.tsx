import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ServicePurchaseSection from "@/components/ServicePurchaseSection";

export default async function ServicePurchasePage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("service_packages")
    .select("id, title, price_usd, delivery_days, whats_included, candidates(display_name)")
    .eq("id", packageId)
    .single();

  if (!pkg) notFound();

  const candidateName =
    (pkg.candidates as { display_name: string } | null)?.display_name ?? "Professional";

  return (
    <ServicePurchaseSection
      packageId={pkg.id}
      packageTitle={pkg.title}
      packagePrice={pkg.price_usd}
      deliveryDays={pkg.delivery_days}
      whatsIncluded={pkg.whats_included}
      candidateName={candidateName}
    />
  );
}
