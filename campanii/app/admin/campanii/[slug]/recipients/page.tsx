"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { RecipientTable } from "@/components/admin/RecipientTable";
import type { Campaign, CampaignRecipient } from "@/lib/types/campaign";
import { ArrowLeft } from "lucide-react";

function RecipientsContent() {
  const params = useParams();
  const slug = params.slug as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/campanii/${slug}`).then((r) => r.json()),
      fetch(`/api/campanii/${slug}/recipients`).then((r) => r.json()),
    ]).then(([campaignData, recipientsData]) => {
      setCampaign(campaignData.error ? null : campaignData);
      setRecipients(Array.isArray(recipientsData) ? recipientsData : []);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return <div className="text-center py-12 text-urban-gray-400">Se încarcă...</div>;
  }

  if (!campaign) {
    return <div className="text-center py-12 text-protest-red-500">Campanie negăsită</div>;
  }

  return (
    <div>
      <a
        href={`/admin/campanii/${slug}/edit`}
        className="inline-flex items-center gap-1 text-sm text-civic-blue-500 hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Înapoi la campanie
      </a>

      <h1 className="heading-civic text-2xl mb-8">
        Destinatari: {campaign.title}
      </h1>

      <RecipientTable campaignSlug={slug} initialRecipients={recipients} />
    </div>
  );
}

export default function RecipientsPage() {
  return (
    <AdminAuthGuard>
      <RecipientsContent />
    </AdminAuthGuard>
  );
}
