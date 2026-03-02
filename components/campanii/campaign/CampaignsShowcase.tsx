"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/campanii/types/campaign";
import { Megaphone, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export function CampaignsShowcase() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/campanii")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || campaigns.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-activist-orange-50 dark:bg-activist-orange-900/20 mb-4">
            <Megaphone className="h-7 w-7 text-activist-orange-500" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-activist-orange-500 mb-3">
            Campanii Civice
          </h2>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Trimite un email direct aleșilor tăi
          </p>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Alege o campanie, completează formularul, iar emailul tău ajunge direct la destinatari. Fiecare voce contează.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.slice(0, 3).map((c) => {
            const count = c.confirmed_count || c.participation_count;
            return (
              <Link
                key={c.id}
                href={`/campanii/${c.slug}`}
                className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-activist-orange-300 dark:hover:border-activist-orange-700 hover:shadow-lg transition-all"
              >
                {c.cover_image_url ? (
                  <div className="h-40 overflow-hidden">
                    <img
                      src={c.cover_image_url}
                      alt={c.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-civic-blue-500 to-civic-blue-700 dark:from-civic-blue-700 dark:to-civic-blue-900 flex items-center justify-center">
                    <Megaphone className="w-10 h-10 text-white/30" />
                  </div>
                )}

                <div className="p-5">
                  {c.organization && (
                    <p className="text-xs font-semibold text-activist-orange-600 dark:text-activist-orange-400 uppercase tracking-wide mb-1">
                      {c.organization}
                    </p>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-civic-blue-600 dark:group-hover:text-civic-blue-400 transition-colors line-clamp-2">
                    {c.title}
                  </h3>
                  {c.short_description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {c.short_description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>
                      <strong className="text-activist-orange-500">{count}</strong> participanți
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/campanii"
            className="inline-flex items-center gap-2 px-6 py-3 bg-activist-orange-500 text-white font-semibold rounded-lg hover:bg-activist-orange-600 transition-colors"
          >
            Vezi toate campaniile
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
