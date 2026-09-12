import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FAQ_CATEGORIES } from '../lib/faqData'
import { Input } from '../components/ui/input'

const DIACRITICS_PATTERN = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')

function normalize(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS_PATTERN, '').toLowerCase()
}

export default function AidePage() {
  const [search, setSearch] = useState('')

  const filteredCategories = useMemo(() => {
    const term = normalize(search.trim())
    if (!term) return FAQ_CATEGORIES

    return FAQ_CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter(
        (item) => normalize(item.question).includes(term) || normalize(item.answer).includes(term)
      ),
    })).filter((category) => category.items.length > 0)
  }, [search])

  function scrollToCategory(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-dvh bg-paper font-registre">
      <header className="bg-ink px-6 pb-16 pt-16 text-paper sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-paper/60">Centre d'aide</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Comment pouvons-nous vous aider ?</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-paper/70">
            Questions fréquentes sur Samakan — dons, adhérents, campagnes, reçus fiscaux et espace bénévole.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une question…"
              className="border-transparent bg-white text-ink"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {!search.trim() && (
          <nav className="mb-10 flex flex-wrap justify-center gap-2">
            {FAQ_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => scrollToCategory(category.id)}
                className="rounded-full border border-paper-border bg-white px-4 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:border-stamp/30 hover:text-stamp"
              >
                {category.label}
              </button>
            ))}
          </nav>
        )}

        {filteredCategories.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-faint">
            Aucune question ne correspond à « {search} ». Essayez un autre mot-clé, ou{' '}
            <a href="mailto:contact@samakan.fr" className="text-stamp underline hover:no-underline">
              contactez-nous directement
            </a>
            .
          </p>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((category) => (
              <section key={category.id} id={category.id} className="scroll-mt-8">
                <h2 className="text-xl font-bold text-ink">{category.label}</h2>
                <div className="mt-4 divide-y divide-paper-border-muted rounded-sm border border-paper-border bg-white">
                  {category.items.map((item) => (
                    <div key={item.question} className="px-5 py-4">
                      <h3 className="font-semibold text-ink">{item.question}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-12 rounded-sm border border-paper-border bg-white p-8 text-center">
          <h2 className="text-lg font-bold text-ink">Vous ne trouvez pas la réponse ?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Écrivez-nous, nous répondons directement.
          </p>
          <a
            href="mailto:contact@samakan.fr"
            className="mt-4 inline-block rounded-sm border border-stamp px-4 py-2 text-sm font-medium text-stamp transition-colors hover:bg-stamp/[0.06]"
          >
            Nous contacter
          </a>
          <p className="mt-6 text-xs text-ink-faint">
            <Link to="/decouvrir" className="underline hover:no-underline">
              Découvrir Samakan
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
