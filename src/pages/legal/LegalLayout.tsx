import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import RecetteBanner from '../../components/RecetteBanner'
import SiteHeader from '../../components/site/SiteHeader'
import SiteFooter from '../../components/site/SiteFooter'
import { cn } from '@/lib/utils'
import { PAGES_LEGALES } from './pagesLegales'

/** Texte à compléter par l'éditeur, signalé visuellement tant qu'il n'est pas rempli. */
export function ACompleter({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm border border-warning-border bg-warning-tint px-1 font-registre-mono text-[0.8125rem] text-warning">
      [{children}]
    </span>
  )
}

export function SectionLegale({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-ink">{titre}</h2>
      <div className="space-y-2 text-[0.9375rem] leading-7 text-ink-muted">{children}</div>
    </section>
  )
}

/** Gabarit commun des pages légales : en-tête du site, onglets entre les trois pages, pied de page. */
export default function LegalLayout({
  titre,
  children,
}: {
  titre: string
  children: ReactNode
}) {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-registre text-ink selection:bg-stamp/15">
      <RecetteBanner />
      <SiteHeader className="border-b border-paper-border bg-white" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <nav aria-label="Pages légales">
          <ul className="flex flex-wrap gap-2 text-sm">
            {PAGES_LEGALES.map((page) => {
              const actif = page.path === pathname
              return (
                <li key={page.path}>
                  <Link
                    to={page.path}
                    aria-current={actif ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center rounded-sm border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
                      actif
                        ? 'border-stamp text-stamp'
                        : 'border-paper-border bg-white text-ink-muted hover:bg-paper',
                    )}
                  >
                    {page.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-ink">{titre}</h1>
        <p className="mt-2 text-sm text-ink-faint">
          Dernière mise à jour : <ACompleter>date</ACompleter>
        </p>
        <div className="mt-10 space-y-10">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}
