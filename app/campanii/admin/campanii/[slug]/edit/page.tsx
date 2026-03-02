"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminAuthGuard } from "@/components/campanii/admin/AdminAuthGuard";
import { CampaignWizard } from "@/components/campanii/admin/wizard/CampaignWizard";
import type { Campaign, CampaignRecipient } from "@/lib/campanii/types/campaign";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

function EditCampaignContent() {
  const params = useParams();
  const slug = params.slug as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/campanii/${slug}`).then((res) => res.json()),
      fetch(`/api/campanii/${slug}/recipients`).then((res) =>
        res.ok ? res.json() : []
      ),
    ]).then(([campaignData, recipientsData]) => {
      if (campaignData.error) {
        setCampaign(null);
      } else {
        setCampaign(campaignData);
      }
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
      <div className="flex items-center justify-between mb-6">
        <a
          href="/campanii/admin"
          className="inline-flex items-center gap-1 text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Înapoi la campanii
        </a>
        <a
          href={`/campanii/admin/campanii/${slug}/stats`}
          className="btn-activist flex items-center gap-2 text-sm py-2"
        >
          <BarChart3 className="w-4 h-4" /> Statistici
        </a>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8">
        Editează: {campaign.title}
      </h1>

      <CampaignWizard campaign={campaign} initialRecipients={recipients} />
    </div>
  );
}

export default function EditCampaignPage() {
  return (
    <AdminAuthGuard>
      <EditCampaignContent />
    </AdminAuthGuard>
  );
}
