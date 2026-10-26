import { useAuth } from './useAuth'

/**
 * Les paramètres de l'organisation (identité, reçus, adhésions, formulaire public, visuels,
 * porte-monnaie) ne sont modifiables que par un admin ou par le super-admin qui consulte
 * l'organisation ; un contributeur les voit en lecture seule (décision du 2026-10-24, audit
 * sécurité). La base l'impose aussi (policies RLS « admin »), l'UI ne fait que le refléter.
 */
export function usePeutModifierParametres(): boolean {
  const { auth } = useAuth()
  return auth.type === 'super_admin' || (auth.type === 'admin' && auth.role === 'admin')
}
