import { notFound } from "next/navigation";
import { getActiveCampaignBySlug } from "@/lib/supabase/campaign-queries";
import { SuccessScreen } from "@/components/campaign/SuccessScreen";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SuccessPage({ params }: PageProps) {
  const { slug } = await params;
  const campaign = await getActiveCampaignBySlug(slug);

  if (!campaign) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://campanii.implicarecivica.ro";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <SuccessScreen
        message={campaign.success_message || "Emailul tău a fost trimis cu succes!"}
        redirectUrl={campaign.redirect_url}
        campaignTitle={campaign.title}
        campaignUrl={`${siteUrl}/${campaign.slug}`}
      />
    </div>
  );
}
