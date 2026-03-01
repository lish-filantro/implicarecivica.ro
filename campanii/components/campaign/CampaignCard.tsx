import type { Campaign } from "@/lib/types/campaign";
import { Users } from "lucide-react";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const count = campaign.confirmed_count || campaign.participation_count;

  return (
    <a href={`/${campaign.slug}`} className="block card-poster group">
      {campaign.cover_image_url && (
        <div className="h-48 -mx-6 -mt-6 mb-4 overflow-hidden">
          <img
            src={campaign.cover_image_url}
            alt={campaign.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {campaign.organization && (
        <p className="text-xs font-semibold text-activist-orange-600 uppercase tracking-wide mb-1">
          {campaign.organization}
        </p>
      )}

      <h2 className="text-xl font-activist uppercase tracking-wide text-civic-blue-700 mb-2">
        {campaign.title}
      </h2>

      {campaign.short_description && (
        <p className="text-sm text-urban-gray-600 mb-4 line-clamp-2">
          {campaign.short_description}
        </p>
      )}

      <div className="flex items-center gap-2 text-sm text-urban-gray-500">
        <Users className="w-4 h-4" />
        <span>
          <strong className="text-activist-orange-500">{count}</strong> participanți
        </span>
      </div>
    </a>
  );
}
