import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActiveCampaignBySlug } from "@/lib/supabase/campaign-queries";
import { getActiveRecipientsByCampaign } from "@/lib/supabase/recipient-queries";
import { CampaignHero } from "@/components/campaign/CampaignHero";
import { ParticipationForm } from "@/components/campaign/ParticipationForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getActiveCampaignBySlug(slug);

  if (!campaign) return { title: "Campanie negăsită" };

  return {
    title: `${campaign.title} | Campanii Civice`,
    description: campaign.short_description || campaign.title,
    openGraph: {
      title: campaign.title,
      description: campaign.short_description || campaign.title,
      images: campaign.cover_image_url ? [campaign.cover_image_url] : undefined,
    },
  };
}

export default async function CampaignPage({ params }: PageProps) {
  const { slug } = await params;
  const campaign = await getActiveCampaignBySlug(slug);

  if (!campaign) {
    notFound();
  }

  // Check expiration
  if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="heading-civic mb-4">Campanie expirată</h1>
        <p className="text-lg text-urban-gray-600">
          Această campanie nu mai este activă.
        </p>
        <a href="/" className="btn-civic inline-block mt-6">
          Vezi campaniile active
        </a>
      </div>
    );
  }

  const recipients = await getActiveRecipientsByCampaign(campaign.id);
  const trackingEmail = process.env.NEXT_PUBLIC_TRACKING_EMAIL || "track@campanii.implicarecivica.ro";

  return (
    <div className="pb-16">
      <CampaignHero campaign={campaign} />

      <div className="max-w-4xl mx-auto px-4 mt-8 grid gap-8 md:grid-cols-5">
        {/* Left column: context */}
        <div className="md:col-span-2">
          {campaign.long_description && (
            <div>
              <h2 className="text-lg font-activist uppercase text-civic-blue-700 mb-3 border-l-4 border-activist-orange-500 pl-3">
                De ce contează
              </h2>
              <div className="text-sm text-urban-gray-600 leading-relaxed whitespace-pre-wrap">
                {campaign.long_description}
              </div>
            </div>
          )}

          {recipients.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-activist uppercase text-urban-gray-500 mb-2">
                Destinatari ({recipients.length})
              </h3>
              <ul className="text-xs text-urban-gray-500 space-y-1">
                {recipients.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <span className="font-semibold">{r.name}</span>
                    {r.role && <span className="text-urban-gray-400"> — {r.role}</span>}
                  </li>
                ))}
                {recipients.length > 10 && (
                  <li className="text-urban-gray-400">
                    ... și alți {recipients.length - 10} destinatari
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: form */}
        <div className="md:col-span-3">
          <div className="bg-white border-2 border-black p-6 shadow-activist">
            <h2 className="text-xl font-activist uppercase text-civic-blue-700 mb-6">
              Participă la campanie
            </h2>
            <ParticipationForm
              campaign={campaign}
              recipientCount={recipients.length}
              trackingEmail={trackingEmail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
