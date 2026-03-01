import type { Campaign } from "@/lib/campanii/types/campaign";
import { LiveCounter } from "./LiveCounter";

interface CampaignHeroProps {
  campaign: Campaign;
}

export function CampaignHero({ campaign }: CampaignHeroProps) {
  return (
    <section className="relative">
      {campaign.cover_image_url && (
        <div className="h-64 md:h-80 overflow-hidden">
          <img
            src={campaign.cover_image_url}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div
        className={`max-w-4xl mx-auto px-4 sm:px-6 ${campaign.cover_image_url ? "-mt-24 relative z-10" : "pt-12"}`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 shadow-lg">
          {campaign.organization && (
            <p className="text-sm font-semibold text-activist-orange-600 dark:text-activist-orange-400 uppercase tracking-wide mb-2">
              {campaign.organization}
            </p>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">{campaign.title}</h1>

          {campaign.short_description && (
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
              {campaign.short_description}
            </p>
          )}

          <LiveCounter count={campaign.confirmed_count || campaign.participation_count} />
        </div>
      </div>
    </section>
  );
}
