export default function AdherentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Adhérents</h1>
        <p className="mt-1 text-sm text-slate-500">Gestion des adhérents de votre organisation.</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-24 text-center">
        <p className="text-sm font-medium text-slate-600">Module à venir</p>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          La gestion des adhérents (formulaire, liste, import, cartes) arrive dans une prochaine étape.
        </p>
      </div>
    </div>
  )
}
