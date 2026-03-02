from __future__ import annotations

import re
import unittest
from pathlib import Path


LINK_RE = re.compile(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', re.IGNORECASE)
SCRIPT_RE = re.compile(r'<script[^>]+src="([^"]+)"', re.IGNORECASE)


class UiSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.project_root = Path(__file__).resolve().parents[1]
        self.pages_dir = self.project_root / "src" / "ui" / "pages"

    def _load_html(self, page_name: str) -> str:
        return (self.pages_dir / page_name).read_text(encoding="utf-8")

    def _resolve_page_asset(self, page_name: str, rel_path: str) -> Path:
        return (self.pages_dir / page_name).parent.joinpath(rel_path).resolve()

    def _script_exists_with_ts_fallback(self, page_name: str, script_src: str) -> bool:
        script_path = self._resolve_page_asset(page_name, script_src)
        if script_path.exists():
            return True
        if script_path.suffix != ".js":
            return False
        ts_path = script_path.with_suffix(".ts")
        return ts_path.exists()

    def test_pages_reference_existing_css_and_scripts(self) -> None:
        pages = ["home.html", "index.html", "opintopolut.html", "quiz.html", "amis-quiz.html"]
        for page in pages:
            with self.subTest(page=page):
                html = self._load_html(page)
                styles = LINK_RE.findall(html)
                scripts = SCRIPT_RE.findall(html)

                self.assertGreaterEqual(len(styles), 1, f"{page} missing stylesheet link")
                self.assertGreaterEqual(len(scripts), 1, f"{page} missing script tags")

                for href in styles:
                    asset_path = self._resolve_page_asset(page, href)
                    self.assertTrue(
                        asset_path.exists(),
                        f"{page} stylesheet does not exist: {href}",
                    )

                for src in scripts:
                    self.assertTrue(
                        self._script_exists_with_ts_fallback(page, src),
                        f"{page} script does not exist (js/ts): {src}",
                    )


if __name__ == "__main__":
    unittest.main()
