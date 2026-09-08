import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllInstitutii, getInstitutieBySlug, getDomeniuForInstitutie } from '@/lib/institutii'
import { PublicNavbar } from '@/components/shared/PublicNavbar'
import { PublicFooter } from '@/components/shared/PublicFooter'
import { InstitutieHeader } from '@/components/public/institutie/InstitutieHeader'
import { CazuriUtilizare } from '@/components/public/institutie/CazuriUtilizare'
import { Atributii, Contestatii } from '@/components/public/institutie/Atributii'
import { Procedura544 } from '@/components/public/institutie/Procedura544'
import { LinkuriOficiale, BazaLegala } from '@/components/public/institutie/LinkuriOficiale'
import { InstitutiiRelated, institutiiSimilare } from '@/components/public/institutie/InstitutiiRelated'
import { InstitutionStats } from '@/components/public/InstitutionStats'

export function generateStaticParams() {
  return getAllInstitutii().map(inst => ({ slug: inst.slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const inst = getInstitutieBySlug(slug)
  if (!inst) {
    return { title: 'Instituție negăsită | Implicare Civică' }
  }
  return {
    title: `${inst.nume_scurt} | Implicare Civică`,
    description: `Informații despre ${inst.nume_oficial}. Află ce poți cere pe Legea 544/2001 și cum să trimiți o cerere de informații publice.`,
  }
}

export default async function InstitutieDetailPage({ params }: PageProps) {
  const { slug } = await params
  const inst = getInstitutieBySlug(slug)

  if (!inst) notFound()

  const domeniu = getDomeniuForInstitutie(inst)
  const similare = institutiiSimilare(inst, domeniu)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <PublicNavbar activePage="/institutii" />

      <article className="pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <InstitutieHeader inst={inst} domeniu={domeniu} />

          {/* 2-column layout */}
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            {/* Main column */}
            <div className="space-y-8">
              <CazuriUtilizare inst={inst} />
              <Atributii inst={inst} />
              <Contestatii inst={inst} />
              <InstitutionStats nume={inst.nume_scurt} slug={inst.slug} />
            </div>

            {/* Sidebar */}
            <aside className="space-y-5 lg:order-last">
              <Procedura544 inst={inst} />
              <LinkuriOficiale inst={inst} />
              <BazaLegala inst={inst} />
            </aside>
          </div>

          <InstitutiiRelated similare={similare} domeniu={domeniu} />
        </div>
      </article>

      <PublicFooter />
    </div>
  )
}
