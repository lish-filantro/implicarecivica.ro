"use client";

import { AdminAuthGuard } from "@/components/campanii/admin/AdminAuthGuard";
import { CampaignForm } from "@/components/campanii/admin/CampaignForm";
import { ArrowLeft } from "lucide-react";

export default function NewCampaignPage() {
  return (
    <AdminAuthGuard>
      <div>
        <a
          href="/campanii/admin"
          className="inline-flex items-center gap-1 text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Înapoi la campanii
        </a>

        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8">Campanie nouă</h1>

        <CampaignForm />
      </div>
    </AdminAuthGuard>
  );
}
