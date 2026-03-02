import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActiveCampaignBySlug } from "@/lib/campanii/campaign-queries";
import { getActiveRecipientsByCampaign } from "@/lib/campanii/recipient-queries";
import { CampaignHero } from "@/components/campanii/campaign/CampaignHero";
import { ParticipationForm } from "@/components/campanii/campaign/ParticipationForm";

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

  if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Campanie expirată</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Această campanie nu mai este activă.
        </p>
        <a href="/campanii" className="btn-civic inline-block mt-6">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8 grid gap-8 md:grid-cols-5">
        <div className="md:col-span-2">
          {campaign.long_description && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 border-l-4 border-activist-orange-500 pl-3">
                De ce contează
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {campaign.long_description}
              </div>
            </div>
          )}

          {recipients.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Destinatari ({recipients.length})
              </h3>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                {recipients.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{r.name}</span>
                    {r.role && <span className="text-gray-400 dark:text-gray-500"> — {r.role}</span>}
                  </li>
                ))}
                {recipients.length > 10 && (
                  <li className="text-gray-400 dark:text-gray-500">
                    ... și alți {recipients.length - 10} destinatari
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
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
