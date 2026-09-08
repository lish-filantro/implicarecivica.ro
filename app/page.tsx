'use client';

import { PublicNavbar } from "@/components/shared/PublicNavbar"
import { PublicFooter } from "@/components/shared/PublicFooter"
import { Hero } from "@/components/public/home/Hero"
import { Features } from "@/components/public/home/Features"
import { HowItWorks } from "@/components/public/home/HowItWorks"
import { Institutii } from "@/components/public/home/Institutii"
import { Cta } from "@/components/public/home/Cta"

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* ─── Nav ─── */}
      <PublicNavbar />

      {/* ─── Hero ─── */}
      <Hero />

      {/* ─── De ce local + Ce construim ─── */}
      <Features />

      {/* ─── Cum funcționează ─── */}
      <HowItWorks />

      {/* ─── Instituții ─── */}
      <Institutii />

      {/* ─── CTA final ─── */}
      <Cta />

      {/* ─── Footer ─── */}
      <PublicFooter />
    </div>
  )
}
