import { StatusNotice } from '../ui/status-notice'

/** Encadré affiché en tête d'une page Paramètres consultée par un contributeur. */
export default function LectureSeuleNotice() {
  return (
    <StatusNotice>
      Vous consultez ces paramètres en lecture seule : seul un administrateur de l’association peut les modifier.
    </StatusNotice>
  )
}
