# Kevyet savutestit käyttöliittymän HTML-sivuille
#
# Tämän tiedoston testit tarkistavat, että jokainen tärkeä sivu viittaa olemassa
# oleviin tyylitiedostoihin ja skripteihin ennen varsinaisia selainajotestejä

from __future__ import annotations  # Siirtää tyyppivihjeiden tulkinnan myöhemmäksi

import re  # Etsii HTML:stä CSS- ja skriptiviittaukset säännöllisillä lausekkeilla
import unittest  # Tarjoaa savutestien testikehyksen
from pathlib import Path  # Ratkoo UI-sivujen ja resurssien tiedostopolut


# Regexit poimivat HTML:stä sivun viittaamat CSS- ja JS-resurssit
LINK_RE = re.compile(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', re.IGNORECASE)
SCRIPT_RE = re.compile(r'<script[^>]+src="([^"]+)"', re.IGNORECASE)


class UiSmokeTests(unittest.TestCase):
    # Varmistaa, että käyttöliittymän sivut osoittavat olemassa oleviin resursseihin

    # Tallentaa projektijuuren ja sivukansion seuraavia testiapureita varten
    def setUp(self) -> None:
        self.project_root = Path(__file__).resolve().parents[1]
        self.pages_dir = self.project_root / "src" / "ui" / "pages"

    # Lukee yhden HTML-sivun testin tarkasteltavaksi
    def _load_html(self, page_name: str) -> str:
        return (self.pages_dir / page_name).read_text(encoding="utf-8")

    # Ratkaisee sivulla käytetyn suhteellisen resurssipolun levyltä löytyväksi poluksi
    def _resolve_page_asset(self, page_name: str, rel_path: str) -> Path:
        return (self.pages_dir / page_name).parent.joinpath(rel_path).resolve()

    # Hyväksyy skriptin joko JS-tiedostona tai lähteenä olevana TS-tiedostona
    def _script_exists_with_ts_fallback(self, page_name: str, script_src: str) -> bool:
        script_path = self._resolve_page_asset(page_name, script_src)
        if script_path.exists():
            return True
        if script_path.suffix != ".js":
            return False
        ts_path = script_path.with_suffix(".ts")
        return ts_path.exists()

    # Jokainen keskeinen HTML-sivu viittaa olemassa oleviin tyyleihin ja skripteihin
    def test_pages_reference_existing_css_and_scripts(self) -> None:
        pages = [
            "home.html",
            "pankki.html",
            "saved-tutkintonimikkeet.html",
            "opintopolut.html",
            "quiz.html",
            "amis-quiz.html",
            "esteettomyys.html",
        ]
        for page in pages:
            with self.subTest(page=page):
                html = self._load_html(page)
                styles = LINK_RE.findall(html)
                scripts = SCRIPT_RE.findall(html)

                self.assertGreaterEqual(len(styles), 1, f"{page} puuttuu tyylitiedostoja")
                self.assertGreaterEqual(len(scripts), 1, f"{page} puuttuu skriptitags")

                for href in styles:
                    asset_path = self._resolve_page_asset(page, href)
                    self.assertTrue(
                        asset_path.exists(),
                        f"{page} tyylitiedosto ei ole olemassa: {href}",
                    )

                for src in scripts:
                    self.assertTrue(
                        self._script_exists_with_ts_fallback(page, src),
                        f"{page} skripti ei ole olemassa (js/ts): {src}",
                    )


if __name__ == "__main__":
    unittest.main()
