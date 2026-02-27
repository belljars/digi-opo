from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock


def load_app_module():
    project_root = Path(__file__).resolve().parents[1]
    app_path = project_root / "src" / "app" / "app.py"
    spec = importlib.util.spec_from_file_location("digi_opo_app", app_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load src/app/app.py")

    fake_webview = types.SimpleNamespace(
        create_window=lambda *args, **kwargs: None,
        start=lambda *args, **kwargs: None,
    )
    sys.modules.setdefault("webview", fake_webview)

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BackendApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = load_app_module()
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        (self.root / "data").mkdir(parents=True, exist_ok=True)
        (self.root / "src" / "data").mkdir(parents=True, exist_ok=True)
        (self.root / "src" / "ui" / "assets" / "opiskeluSuunnat").mkdir(
            parents=True, exist_ok=True
        )
        (self.root / "src" / "ui" / "assets" / "opiskeluSuunnat" / "lukio.jpg").write_bytes(
            b"jpg"
        )

        ammatit_payload = {
            "tutkinnot": [
                {
                    "nimi": "Sahkoala",
                    "desc": "Sahkoalan perustutkinto",
                    "tutkintonimikkeet": [
                        {"nimi": "Sahkoasentaja", "linkki": "https://example.invalid/sahko"}
                    ],
                },
                {
                    "nimi": "Kokki",
                    "desc": "Ravintola- ja catering-ala",
                    "tutkintonimikkeet": [{"nimi": "Kokki", "linkki": ""}],
                },
            ]
        }
        (self.root / "src" / "data" / "ammatit.json").write_text(
            json.dumps(ammatit_payload), encoding="utf-8"
        )

        opiskelu_payload = {
            "opiskeluSuunnat": [
                {
                    "id": 1,
                    "img": "assets/opiskeluSuunnat/lukio.jpg",
                    "nimi": "Lukio",
                    "desc": "Yleissivistava polku",
                    "kenelle": "- Teoria\n- Jatko-opinnot",
                }
            ]
        }
        (self.root / "src" / "data" / "opiskeluSuunnat.json").write_text(
            json.dumps(opiskelu_payload), encoding="utf-8"
        )

        quiz_payload = {
            "meta": {"id": "quiz", "title": "Quiz", "language": "fi-FI", "version": 1, "estimatedMinutes": 1},
            "paths": [{"id": "lukio", "label": "Lukio", "summary": "Yleissivistys"}],
            "scoring": {"scale": "0-2", "tieBreakers": ["lukio"], "minAnswers": 1},
            "questions": [
                {
                    "id": "q1",
                    "text": "Kysymys 1",
                    "type": "single",
                    "options": [{"id": "a", "text": "A", "score": {"lukio": 1}}],
                }
            ],
        }
        (self.root / "src" / "data" / "opintopolkuQuiz.json").write_text(
            json.dumps(quiz_payload), encoding="utf-8"
        )

    def tearDown(self) -> None:
        self.tmpdir.cleanup()

    def test_api_imports_data_and_search_works(self) -> None:
        with mock.patch.object(self.app, "_project_root", return_value=self.root):
            api = self.app.Api()
            tutkinnot = api.list_tutkinnot()
            self.assertEqual(len(tutkinnot), 2)

            results = api.search_tutkinnot("sahko")
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["nimi"], "Sahkoala")

            detail = api.get_tutkinto(results[0]["id"])
            self.assertIsNotNone(detail)
            self.assertEqual(detail["tutkintonimikkeet"][0]["nimi"], "Sahkoasentaja")

    def test_opiskelu_suunnat_image_is_normalized_for_http(self) -> None:
        with mock.patch.object(self.app, "_project_root", return_value=self.root):
            api = self.app.Api()
            items = api.list_opiskelu_suunnat()
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["img"], "/src/ui/assets/opiskeluSuunnat/lukio.jpg")

    def test_opintopolku_quiz_payload_is_available(self) -> None:
        with mock.patch.object(self.app, "_project_root", return_value=self.root):
            api = self.app.Api()
            quiz = api.get_opintopolku_quiz()
            self.assertIn("questions", quiz)
            self.assertGreater(len(quiz["questions"]), 0)


if __name__ == "__main__":
    unittest.main()
