"""Test de fumée de la démo publique (demo.samakan.fr), lancé par `npm run demo:smoke`.

Construit la démo dans un dossier temporaire, la sert en local comme Vercel (scripts/serve-demo.mjs,
CSP de la démo comprise), puis, avec Playwright (Chromium) :
  1. démarre la démo (base en mémoire, ?mem) et vérifie le tableau de bord ;
  2. ouvre les 18 écrans admin, sans erreur console, sans requête en échec ;
  3. saisit un don et le retrouve dans la liste ;
  4. parcours bénévole : PIN 123456, saisie d'un don ;
  5. vérifie qu'aucune requête n'est partie hors de la démo.
Sort en code 1, avec la liste des échecs, au premier problème de structure (ex. instantané du
schéma cassé : la démo ne démarre pas et l'erreur affichée est recopiée).

Options : --dist <dossier> pour tester un build existant (sans reconstruire), --headed.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO_PIN = "123456"
BOOT_TIMEOUT_MS = 90_000
SCREEN_TIMEOUT_MS = 15_000
# Les 18 écrans admin (menu complet de l'organisation de démo) et le titre attendu.
SCREENS = [
    ("/admin", "Tableau de bord"),
    ("/admin/dons", "Dons"),
    ("/admin/participants", "Donateurs"),
    ("/admin/recus", "Reçus fiscaux"),
    ("/admin/statistiques", "Statistiques"),
    ("/admin/dons/parametres", None),
    ("/admin/dons-reguliers", "Dons réguliers"),
    ("/admin/adherents", "Adhérents"),
    ("/admin/adherents/renouvellements", None),
    ("/admin/adherents/parametres", None),
    ("/admin/adherents/journal", None),
    ("/admin/communication/emailing", None),
    ("/admin/communication/courrier", None),
    ("/admin/activites", "Activités"),
    ("/admin/parametres", None),
    ("/admin/parametres/equipe", None),
    ("/admin/parametres/compte", None),
    ("/admin/parametres/integrations", None),
]
# Journal des réponses de la couche Supabase locale (servie dans l'onglet, donc invisible pour
# Playwright) : on enveloppe fetch une fois la démo démarrée.
TRACK_FETCH = """() => {
  if (window.__smokeFetch) return
  window.__smokeFetch = []
  const inner = window.fetch
  window.fetch = async (...args) => {
    const url = String(args[0] instanceof Request ? args[0].url : args[0])
    try {
      const res = await inner(...args)
      if (res.status >= 400) window.__smokeFetch.push(res.status + ' ' + url)
      return res
    } catch (err) {
      window.__smokeFetch.push('échec ' + url + ' : ' + err)
      throw err
    }
  }
}"""
GO_TO = "p => { history.pushState(null, '', p); dispatchEvent(new PopStateEvent('popstate')) }"


class Smoke:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.console_errors: list[str] = []
        self.network_errors: list[str] = []
        self.external: list[str] = []

    def check(self, label: str, ok: bool, detail: str = "") -> bool:
        print(("  ok   " if ok else "  ÉCHEC ") + label + ("" if ok or not detail else f" — {detail}"))
        if not ok:
            self.failures.append(label + (f" — {detail}" if detail else ""))
        return ok

    def drain(self, page) -> list[str]:
        """Erreurs survenues depuis le dernier appel (console, réseau, couche Supabase locale)."""
        errors = self.console_errors + self.network_errors
        try:
            errors += page.evaluate("() => (window.__smokeFetch || []).splice(0)")
        except PlaywrightError:
            pass
        self.console_errors.clear()
        self.network_errors.clear()
        return errors

    def watch(self, page, base: str) -> None:
        page.on("console", lambda m: self.console_errors.append("console : " + m.text[:300]) if m.type == "error" else None)
        page.on("pageerror", lambda e: self.console_errors.append("exception : " + str(e)[:300]))
        page.on("requestfailed", lambda r: self.network_errors.append(f"requête en échec : {r.url} ({r.failure})"))
        page.on("response", lambda r: self.network_errors.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        page.on("request", lambda r: None if r.url.startswith(base) or r.url.startswith(("data:", "blob:")) else self.external.append(r.url))


def build(out_dir: str) -> None:
    print("Build de la démo…")
    cmd = ["npx", "vite", "build", "--config", "vite.demo.config.ts", "--outDir", out_dir, "--emptyOutDir", "--logLevel", "error"]
    subprocess.run(cmd, cwd=ROOT, check=True)


def start_server(dist: str) -> tuple[subprocess.Popen, str]:
    proc = subprocess.Popen(["node", os.path.join(ROOT, "scripts", "serve-demo.mjs"), dist, "0"], stdout=subprocess.PIPE, text=True)
    line = proc.stdout.readline().split() if proc.stdout else []
    if len(line) != 2 or line[0] != "ok":
        proc.kill()
        sys.exit("demo:smoke : le serveur local de la démo n'a pas démarré")
    # localhost : contexte sécurisé, condition de démarrage de la démo.
    return proc, f"http://localhost:{line[1]}"


def wait_boot(smoke: Smoke, page, url: str, label: str) -> bool:
    start = time.time()
    page.goto(url)
    try:
        page.wait_for_function(
            "() => !document.getElementById('demo-loading') || !!document.querySelector('#demo-loading [role=alert]')",
            timeout=BOOT_TIMEOUT_MS,
        )
    except PlaywrightError:
        return smoke.check(label, False, f"démarrage non terminé après {BOOT_TIMEOUT_MS // 1000} s")
    overlay = page.query_selector("#demo-loading [role=alert]")
    if overlay is not None:
        text = re.sub(r"\s+", " ", overlay.inner_text()).strip()
        return smoke.check(label, False, f"la démo affiche une erreur : « {text[:400]} » ; " + "; ".join(smoke.drain(page))[:1500])
    page.evaluate(TRACK_FETCH)
    return smoke.check(f"{label} ({time.time() - start:.1f} s)", True)


def h1_text(page) -> str:
    return re.sub(r"\s+", " ", page.inner_text("h1")).strip()


def open_screens(smoke: Smoke, page) -> None:
    for path, title in SCREENS:
        page.evaluate(GO_TO, path)
        try:
            page.wait_for_function("p => location.pathname === p && !!document.querySelector('main h1, h1')", arg=path, timeout=SCREEN_TIMEOUT_MS)
            # Laisse les requêtes de l'écran aboutir (servies dans l'onglet : quelques ms chacune).
            page.wait_for_timeout(1200)
            heading = h1_text(page)
        except PlaywrightError:
            smoke.check(f"écran {path}", False, "pas de titre affiché")
            smoke.drain(page)
            continue
        errors = smoke.drain(page)
        ok_title = title is None or heading.startswith(title)
        detail = "; ".join(errors)[:1500] if errors else f"titre « {heading} », attendu « {title} »"
        smoke.check(f"écran {path} « {heading} »", ok_title and not errors, detail)


def enter_admin_don(smoke: Smoke, page) -> None:
    page.evaluate(GO_TO, "/admin/dons")
    page.wait_for_function("() => location.pathname === '/admin/dons'")
    page.get_by_role("button", name="Saisir un don").click()
    dialog = page.get_by_role("dialog")
    search = dialog.get_by_placeholder("Rechercher par nom et prénom…")
    search.fill("e")
    option = search.locator("xpath=../..").locator("div.absolute button").first
    try:
        option.wait_for(timeout=SCREEN_TIMEOUT_MS)
    except PlaywrightError:
        smoke.check("saisie d'un don (admin)", False, "aucun donateur proposé à la recherche")
        return
    donor = option.inner_text().strip()
    option.dispatch_event("mousedown")
    dialog.locator("#don-montant").fill("987.65")
    dialog.locator("#don-mode-paiement").select_option("2")
    dialog.get_by_role("button", name="Enregistrer").click()
    try:
        page.get_by_role("dialog").wait_for(state="detached", timeout=SCREEN_TIMEOUT_MS)
        # Ligne du tableau (la liste a aussi une version mobile, masquée à cette largeur).
        page.wait_for_function(
            "d => [...document.querySelectorAll('main tr')].some(tr => tr.innerText.includes('987,65') && tr.innerText.includes(d))",
            arg=donor,
            timeout=SCREEN_TIMEOUT_MS,
        )
        ok = True
    except PlaywrightError:
        ok = False
    errors = smoke.drain(page)
    smoke.check(f"saisie d'un don (admin, {donor}, 987,65 €) visible dans la liste", ok and not errors, "; ".join(errors)[:1500] or "don absent de la liste")


def benevole(smoke: Smoke, page, base: str) -> None:
    if not wait_boot(smoke, page, f"{base}/login/benevole?mem", "démarrage de la démo côté bénévole"):
        return
    try:
        page.locator("#pin").fill(DEMO_PIN)
        page.get_by_role("button", name="Accéder").click()
        page.get_by_role("heading", name="Saisie d'un don").wait_for(timeout=SCREEN_TIMEOUT_MS)
    except PlaywrightError:
        smoke.check(f"connexion bénévole (PIN {DEMO_PIN})", False, "; ".join(smoke.drain(page))[:1500] or "écran de saisie absent")
        return
    smoke.check(f"connexion bénévole (PIN {DEMO_PIN})", not (errors := smoke.drain(page)), "; ".join(errors)[:1500])
    search = page.get_by_placeholder("Rechercher un donateur…")
    search.fill("e")
    option = search.locator("xpath=../..").locator("div.absolute button").first
    try:
        option.wait_for(timeout=SCREEN_TIMEOUT_MS)
        option.dispatch_event("mousedown")
        page.get_by_placeholder("0.00").fill("54.32")
        page.get_by_role("button", name="Espèces").click()
        page.get_by_role("button", name="Enregistrer le don").click()
        page.get_by_role("heading", name="Don enregistré !").wait_for(timeout=SCREEN_TIMEOUT_MS)
        ok = True
    except PlaywrightError:
        ok = False
    errors = smoke.drain(page)
    smoke.check("saisie d'un don (bénévole, 54,32 €)", ok and not errors, "; ".join(errors)[:1500] or "confirmation absente")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dist", help="build existant de la démo (dossier contenant demo.html)")
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()

    tmp = None
    dist = args.dist
    if not dist:
        tmp = tempfile.mkdtemp(prefix="demo-smoke-")
        dist = tmp
        build(dist)
    server, base = start_server(dist)
    smoke = Smoke()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=not args.headed)
            context = browser.new_context(viewport={"width": 1280, "height": 900}, locale="fr-FR")
            page = context.new_page()
            smoke.watch(page, base)
            print(f"Démo servie sur {base}")
            if wait_boot(smoke, page, f"{base}/admin?mem", "démarrage de la démo (admin)"):
                smoke.check("tableau de bord affiché", h1_text(page) == "Tableau de bord", f"titre « {h1_text(page)} »")
                startup = smoke.drain(page)
                smoke.check("démarrage sans erreur console ni requête en échec", not startup, "; ".join(startup)[:1500])
                open_screens(smoke, page)
                enter_admin_don(smoke, page)
                benevole(smoke, page, base)
            blocked = page.evaluate("() => (window.__demo && window.__demo.blocked) || []") if not page.is_closed() else []
            smoke.check("aucune requête externe", not smoke.external and not blocked, "; ".join(smoke.external + blocked)[:1500])
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)

    if smoke.failures:
        print(f"\ndemo:smoke : {len(smoke.failures)} échec(s)")
        for f in smoke.failures:
            print(" - " + f)
        return 1
    print("\ndemo:smoke : tout est vert")
    return 0


if __name__ == "__main__":
    sys.exit(main())
