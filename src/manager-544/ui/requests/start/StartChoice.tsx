import Link from 'next/link';
import { ArrowRight, MessageSquare, PenLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Ecranul „Cerere nouă": primul pas al unei sesiuni noi. Intrat direct în wizard, omul dădea de
 * categoriile de întrebări A–E goale (acestea există doar când asistentul a pregătit un set), așa
 * că întâi alege drumul: îşi scrie singur cererea sau lasă asistentul să găsească instituţia şi
 * să propună întrebările. Istoricul conversaţiilor rămâne în chat, la un link distanţă.
 */

interface PathCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  accent: 'blue' | 'orange';
}

const ACCENTS = {
  blue: {
    icon: 'bg-civic-blue-50 text-civic-blue-700 dark:bg-civic-blue-900/30 dark:text-civic-blue-300',
    cta: 'text-civic-blue-700 dark:text-civic-blue-300',
    ring: 'hover:border-civic-blue-300 dark:hover:border-civic-blue-700 focus-visible:ring-civic-blue-500/50',
  },
  orange: {
    icon: 'bg-activist-orange-50 text-activist-orange-600 dark:bg-activist-orange-900/20 dark:text-activist-orange-300',
    cta: 'text-activist-orange-600 dark:text-activist-orange-300',
    ring: 'hover:border-activist-orange-300 dark:hover:border-activist-orange-700 focus-visible:ring-activist-orange-500/50',
  },
} as const;

function PathCard({ href, icon: Icon, title, description, cta, accent }: PathCardProps) {
  const a = ACCENTS[accent];
  return (
    <Link
      href={href}
      className={`group flex flex-col h-full rounded-2xl border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-800 p-5 sm:p-6 transition-all duration-200
                  hover:shadow-md focus:outline-none focus-visible:ring-2 ${a.ring}`}
    >
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${a.icon}`} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{title}</span>
      <span className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{description}</span>
      <span className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium ${a.cta}`}>
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function StartChoice() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cerere nouă</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ai dreptul să afli cum sunt cheltuiți banii publici și cum se iau deciziile. Alege cum vrei să începi.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PathCard
          href="/requests/new"
          icon={PenLine}
          accent="blue"
          title="Știu instituția și întrebările"
          description="Completezi numele și adresa de email a instituției, apoi scrii întrebările tale. Noi redactăm cererea conform Legii 544/2001 și o trimitem."
          cta="Scriu cererea"
        />
        <PathCard
          href="/chat"
          icon={MessageSquare}
          accent="orange"
          title="Am nevoie de ajutor"
          description="Descrie-i asistentului problema cu vorbele tale. Te ajută să găsești instituția potrivită și îți pregătește întrebările."
          cta="Vorbesc cu asistentul"
        />
      </div>

      <p className="mt-6 text-center">
        <Link
          href="/chat"
          className="text-sm text-gray-500 dark:text-gray-400 underline-offset-4 hover:underline hover:text-gray-700 dark:hover:text-gray-200"
        >
          sau continuă o conversație existentă
        </Link>
      </p>
    </div>
  );
}
