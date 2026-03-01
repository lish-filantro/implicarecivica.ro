"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminAuthGuard } from "@/components/campanii/admin/AdminAuthGuard";
import { CampaignForm } from "@/components/campanii/admin/CampaignForm";
import type { Campaign } from "@/lib/campanii/types/campaign";
import { ArrowLeft, Users, BarChart3 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

function EditCampaignContent() {
  const params = useParams();
  const slug = params.slug as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campanii/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setCampaign(null);
        } else {
          setCampaign(data);
        }
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
        href="/campanii/admin"
        className="inline-flex items-center gap-1 text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Înapoi la campanii
      </a>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Editează: {campaign.title}</h1>
        <div className="flex items-center gap-2">
          <a
            href={`/campanii/admin/campanii/${slug}/recipients`}
            className="btn-civic flex items-center gap-2 text-sm py-2"
          >
            <Users className="w-4 h-4" /> Destinatari
          </a>
          <a
            href={`/campanii/admin/campanii/${slug}/stats`}
            className="btn-activist flex items-center gap-2 text-sm py-2"
          >
            <BarChart3 className="w-4 h-4" /> Statistici
          </a>
        </div>
      </div>

      <CampaignForm campaign={campaign} />
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
