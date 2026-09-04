import { downloadCsv } from '../lib/csvExport'
import { copyTextToClipboard } from '../lib/clipboard'
import { Button } from './ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table'

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
    <div className="rounded-sm border border-paper-border bg-white p-5 font-registre">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-ink">Récapitulatif déclaratif (article 222 bis CGI)</h2>
          <p className="mt-1 text-sm text-ink-faint">
            Chiffres à recopier manuellement dans la télédéclaration annuelle — aucune donnée nominative.
          </p>
        </div>
        {rows.length > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => exportDeclarationCsv(rows)}>
            Exporter en CSV
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Aucun reçu fiscal généré pour le moment</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Année</TableHead>
                <TableHead>Nombre de reçus émis</TableHead>
                <TableHead>Montant total des dons</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.annee}>
                  <TableCell className="font-medium text-ink">{row.annee}</TableCell>
                  <TableCell className="text-ink-muted">{row.nbRecus}</TableCell>
                  <TableCell className="text-ink-muted">{formatEur(row.montant)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="secondary" size="sm" onClick={() => copyDeclarationRow(row)}>
                      Copier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        Déclaration à effectuer avant le 2ᵉ jour ouvré suivant le 1ᵉʳ mai N+1 (ou dans les 3 mois suivant
        la clôture de l'exercice pour les organismes n'étant pas sur l'année civile), directement sur
        impots.gouv.fr ou demarches-simplifiees.fr selon le statut de l'organisme. Samakan ne soumet rien
        automatiquement — c'est une auto-déclaration à la charge de l'organisation.
      </p>
    </div>
  )
}
