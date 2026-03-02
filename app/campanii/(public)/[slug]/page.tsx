import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActiveCampaignBySlug } from "@/lib/campanii/campaign-queries";
import { getActiveRecipientsByCampaign } from "@/lib/campanii/recipient-queries";
import { CampaignHero } from "@/components/campanii/campaign/CampaignHero";
import { ParticipationForm } from "@/components/campanii/campaign/ParticipationForm";
import { ShareButton } from "@/components/campanii/campaign/ShareButton";
import { renderEmailBody } from "@/lib/campanii/mailto";
import { formatDate } from "@/lib/utils";
import { Users, ArrowLeft, Share2, Mail } from "lucide-react";
import Link from "next/link";

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

      {/* Nav breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 flex items-center justify-between">
        <Link
          href="/campanii"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-civic-blue-500 dark:hover:text-civic-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Toate campaniile
        </Link>
        <ShareButton title={campaign.title} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 grid gap-8 lg:grid-cols-2">
        {/* Left: Email text + context */}
        <div className="space-y-6">
          {/* Full email preview — always visible */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/50 px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-civic-blue-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Emailul pe care îl vei trimite
              </span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                <p><span className="font-medium">Către:</span> {recipients.map((r) => r.name).slice(0, 3).join(", ")}{recipients.length > 3 ? ` și alți ${recipients.length - 3}` : ""}</p>
                <p><span className="font-medium">Subiect:</span> <span className="text-gray-900 dark:text-white">{campaign.email_subject}</span></p>
              </div>
              <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {renderEmailBody(campaign.email_body, {
                  nume_participant: "[Numele tău]",
                  oras_participant: "[Orașul tău]",
                  profesie_participant: "[Profesia ta]",
                  organizatie_participant: "[Organizația ta]",
                  telefon_participant: "[Telefonul tău]",
                  sector_participant: "[Sectorul tău]",
                  data: formatDate(new Date()),
                  organizatie: campaign.organization || undefined,
                })}
                {campaign.email_signature && (
                  <>
                    {"\n\n"}
                    {campaign.email_signature}
                  </>
                )}
              </div>
            </div>
            <div className="px-5 py-2.5 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Câmpurile dintre paranteze pătrate se completează automat cu datele tale.
              </p>
            </div>
          </div>

          {campaign.long_description && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-1 h-6 bg-activist-orange-500 rounded-full" />
                De ce contează
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {campaign.long_description}
              </div>
            </div>
          )}

          {recipients.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Destinatari ({recipients.length})
              </h3>
              <ul className="space-y-2">
                {recipients.slice(0, 10).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-full bg-civic-blue-100 dark:bg-civic-blue-900/30 flex items-center justify-center text-xs font-bold text-civic-blue-600 dark:text-civic-blue-400">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{r.name}</span>
                      {r.role && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">{r.role}</span>}
                    </div>
                  </li>
                ))}
                {recipients.length > 10 && (
                  <li className="text-xs text-gray-400 dark:text-gray-500 pl-10">
                    ... și alți {recipients.length - 10} destinatari
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Participation Form */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 shadow-lg lg:sticky lg:top-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-civic-blue-500" />
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

