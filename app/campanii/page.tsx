import { getActiveCampaigns } from "@/lib/campanii/campaign-queries";
import { CampaignCard } from "@/components/campanii/campaign/CampaignCard";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CampaignsIndexPage() {
  const campaigns = await getActiveCampaigns();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 rounded-xl bg-activist-orange-50 dark:bg-activist-orange-900/20 mb-4">
          <Megaphone className="h-8 w-8 text-activist-orange-500" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Campanii Civice Active
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Trimite emailuri direct către aleșii tăi locali. Fiecare email contează.
          Alege o campanie și fă-ți vocea auzită.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          <p className="text-gray-400 dark:text-gray-500 text-lg">
            Nu sunt campanii active momentan. Revino curând!
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
