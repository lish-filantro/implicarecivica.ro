import { getActiveCampaigns } from "@/lib/supabase/campaign-queries";
import { CampaignCard } from "@/components/campaign/CampaignCard";

export const dynamic = "force-dynamic";

export default async function CampaignsIndexPage() {
  const campaigns = await getActiveCampaigns();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="heading-protest mb-4">Campanii Civice Active</h1>
        <p className="text-lg text-urban-gray-600 max-w-2xl mx-auto">
          Trimite emailuri direct către aleșii tăi locali. Fiecare email contează.
          Alege o campanie și fă-ți vocea auzită.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-urban-gray-400 text-lg">
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
