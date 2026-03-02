import type { Campaign } from "@/lib/campanii/types/campaign";
import { LiveCounter } from "./LiveCounter";
import { Megaphone, Building2 } from "lucide-react";

interface CampaignHeroProps {
  campaign: Campaign;
}

export function CampaignHero({ campaign }: CampaignHeroProps) {
  return (
    <section className="relative">
      {/* Cover image or gradient fallback */}
      {campaign.cover_image_url ? (
        <div className="h-72 md:h-96 overflow-hidden">
          <img
            src={campaign.cover_image_url}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-gray-900/10" />
        </div>
      ) : (
        <div className="h-56 md:h-72 bg-gradient-to-br from-civic-blue-600 via-civic-blue-700 to-civic-blue-900 dark:from-civic-blue-800 dark:via-civic-blue-900 dark:to-gray-900">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-10 right-20 w-48 h-48 rounded-full bg-activist-orange-500/20 blur-3xl" />
          </div>
        </div>
      )}

      {/* Content overlay */}
      <div
        className={`max-w-5xl mx-auto px-4 sm:px-6 ${
          campaign.cover_image_url ? "-mt-32 md:-mt-40" : "-mt-28 md:-mt-36"
        } relative z-10 pb-2`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-10 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1 min-w-0">
              {campaign.organization && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-activist-orange-50 dark:bg-activist-orange-900/20 border border-activist-orange-200 dark:border-activist-orange-800 mb-4">
                  <Building2 className="w-3.5 h-3.5 text-activist-orange-600 dark:text-activist-orange-400" />
                  <span className="text-sm font-semibold text-activist-orange-700 dark:text-activist-orange-300">
                    {campaign.organization}
                  </span>
                </div>
              )}

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
                {campaign.title}
              </h1>

              {campaign.short_description && (
                <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl">
                  {campaign.short_description}
                </p>
              )}
            </div>

            {/* Counter card */}
            <div className="flex-shrink-0 bg-gradient-to-br from-activist-orange-50 to-activist-orange-100 dark:from-activist-orange-900/20 dark:to-activist-orange-800/10 rounded-xl border border-activist-orange-200 dark:border-activist-orange-800/50 p-5 text-center min-w-[160px]">
              <Megaphone className="w-6 h-6 text-activist-orange-500 mx-auto mb-2" />
              <LiveCounter count={campaign.confirmed_count || campaign.participation_count} />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">au trimis emailul</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
