"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminAuthGuard } from "@/components/campanii/admin/AdminAuthGuard";
import { RecipientTable } from "@/components/campanii/admin/RecipientTable";
import type { Campaign, CampaignRecipient } from "@/lib/campanii/types/campaign";
import { ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

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
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-protest-red-500 dark:text-protest-red-400">Campanie negăsită</p>
      </div>
    );
  }

  return (
    <div>
      <a
        href={`/campanii/admin/campanii/${slug}/edit`}
        className="inline-flex items-center gap-1 text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Înapoi la campanie
      </a>

      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8">
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
