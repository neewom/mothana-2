import { ACompleter } from './LegalLayout'

/** Plan des sections d'une page légale dont le contenu reste à rédiger. */
export default function PlanLegal({ sections }: { sections: readonly string[] }) {
  return (
    <section>
      <p className="text-[0.9375rem] leading-7 text-ink-muted">
        <ACompleter>contenu à rédiger</ACompleter> Plan prévu :
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-[0.9375rem] leading-7 text-ink-muted marker:font-registre-mono marker:text-ink-faint">
        {sections.map((section) => (
          <li key={section}>{section}</li>
        ))}
      </ol>
    </section>
  )
}
