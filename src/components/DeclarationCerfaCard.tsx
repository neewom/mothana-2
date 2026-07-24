import { downloadCsv } from '../lib/csvExport'
import { copyTextToClipboard } from '../lib/clipboard'

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

export interface DeclarationCerfaRow {
  annee: number
  nbRecus: number
  montant: number
}

interface DeclarationCerfaCardProps {
  rows: DeclarationCerfaRow[]
  loading: boolean
}

function copyDeclarationRow(row: DeclarationCerfaRow) {
  copyTextToClipboard(
    `Article 222 bis CGI — ${row.annee} : ${row.nbRecus} reçu${row.nbRecus > 1 ? 's' : ''} émis, montant total ${formatEur(row.montant)}`
  )
}

function exportDeclarationCsv(rows: DeclarationCerfaRow[]) {
  downloadCsv(
    'recapitulatif-declaratif-222-bis.csv',
    rows.map((row) => ({
      'Année': row.annee,
      'Nombre de reçus émis': row.nbRecus,
      'Montant total des dons (€)': row.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    }))
  )
}

export default function DeclarationCerfaCard({ rows, loading }: DeclarationCerfaCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Récapitulatif déclaratif (article 222 bis CGI)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Chiffres à recopier manuellement dans la télédéclaration annuelle — aucune donnée nominative.
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => exportDeclarationCsv(rows)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Exporter en CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun reçu fiscal généré pour le moment</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Année</th>
                <th className="py-2 pr-4 font-medium">Nombre de reçus émis</th>
                <th className="py-2 pr-4 font-medium">Montant total des dons</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.annee} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-slate-900">{row.annee}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.nbRecus}</td>
                  <td className="py-2 pr-4 text-slate-700">{formatEur(row.montant)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => copyDeclarationRow(row)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Copier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Déclaration à effectuer avant le 2ᵉ jour ouvré suivant le 1ᵉʳ mai N+1 (ou dans les 3 mois suivant
        la clôture de l'exercice pour les organismes n'étant pas sur l'année civile), directement sur
        impots.gouv.fr ou demarches-simplifiees.fr selon le statut de l'organisme. Mothana ne soumet rien
        automatiquement — c'est une auto-déclaration à la charge de l'organisation.
      </p>
    </div>
  )
}
