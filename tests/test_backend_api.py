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
        raise RuntimeError("Ei pystynyt lataamaan src/app/app.py")

    fake_webview = types.SimpleNamespace(
        create_window=lambda *args, **kwargs: None,
        start=lambda *args, **kwargs: None,
    )
    sys.modules.setdefault("webview", fake_webview) # Mockataan webview, jotta app.py ei yritä luoda oikeaa ikkunaa testatessa

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BackendApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = load_app_module()
        self._apis = []
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        (self.root / "data").mkdir(parents=True, exist_ok=True)
        (self.root / "src" / "data").mkdir(parents=True, exist_ok=True)
        (self.root / "src" / "ui" / "pages").mkdir(parents=True, exist_ok=True)
        (self.root / "src" / "ui" / "assets" / "opiskeluSuunnat").mkdir(
            parents=True, exist_ok=True
        )
        (self.root / "src" / "ui" / "pages" / "home.html").write_text(
            "<!doctype html><title>digi-opo</title>",
            encoding="utf-8",
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
                        {
                            "nimi": "Sahkoasentaja",
                            "linkki": "https://example.invalid/sahko",
                            "img": "assets/ammatit/sahkoasentaja.png",
                        }
                    ],
                },
                {
                    "nimi": "Kokki",
                    "desc": "Ravintola- ja catering-ala",
                    "tutkintonimikkeet": [{"nimi": "Kokki", "linkki": "", "img": ""}],
                },
            ]
        }
        (self.root / "src" / "ui" / "assets" / "ammatit").mkdir(parents=True, exist_ok=True)
        (self.root / "src" / "ui" / "assets" / "ammatit" / "sahkoasentaja.png").write_bytes(
            b"png"
        )
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
        for api in self._apis:
            api.close()
        self.tmpdir.cleanup()

    def create_api(self):
        with mock.patch.object(self.app, "_project_root", return_value=self.root):
            api = self.app.Api()
        self._apis.append(api)
        return api

    def test_api_imports_data_and_search_works(self) -> None:
        api = self.create_api()
        tutkinnot = api.list_tutkinnot()
        self.assertEqual(len(tutkinnot), 2)

        results = api.search_tutkinnot("sahko")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["nimi"], "Sahkoala")

        detail = api.get_tutkinto(results[0]["id"])
        self.assertIsNotNone(detail)
        self.assertEqual(detail["tutkintonimikkeet"][0]["nimi"], "Sahkoasentaja")
        self.assertIn("id", detail["tutkintonimikkeet"][0])
        self.assertEqual(
            detail["tutkintonimikkeet"][0]["img"],
            "/src/ui/assets/ammatit/sahkoasentaja.png",
        )

        all_items = api.list_tutkintonimikkeet()
        sahkoasentaja = next(item for item in all_items if item["nimi"] == "Sahkoasentaja")
        self.assertEqual(
            sahkoasentaja["img"],
            "/src/ui/assets/ammatit/sahkoasentaja.png",
        )

    def test_opiskelu_suunnat_image_is_normalized_for_http(self) -> None:
        api = self.create_api()
        items = api.list_opiskelu_suunnat()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["img"], "/src/ui/assets/opiskeluSuunnat/lukio.jpg")

    def test_opintopolku_quiz_payload_is_available(self) -> None:
        api = self.create_api()
        quiz = api.get_opintopolku_quiz()
        self.assertIn("questions", quiz)
        self.assertGreater(len(quiz["questions"]), 0)

    def test_saved_tutkintonimikkeet_are_persisted_in_sqlite(self) -> None:
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        saved = api.save_tutkintonimike(all_items[0]["id"])

        self.assertEqual(saved["nimi"], all_items[0]["nimi"])

        saved_items = api.list_saved_tutkintonimikkeet()
        self.assertEqual(len(saved_items), 1)
        self.assertEqual(saved_items[0]["id"], all_items[0]["id"])

        db_path = self.root / "data" / "tutkinnot.db"
        self.assertTrue(db_path.exists())
        import sqlite3

        conn = sqlite3.connect(db_path)
        try:
            row = conn.execute(
                "SELECT tutkintonimike_id FROM saved_tutkintonimikkeet;"
            ).fetchone()
        finally:
            conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], all_items[0]["id"])

    def test_saved_tutkintonimike_can_be_removed(self) -> None:
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        api.save_tutkintonimike(all_items[0]["id"])

        removed = api.remove_saved_tutkintonimike(all_items[0]["id"])
        self.assertTrue(removed)
        self.assertEqual(api.list_saved_tutkintonimikkeet(), [])

    def test_tutkintonimike_note_can_be_saved_listed_and_removed(self) -> None:
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()

        saved_note = api.save_tutkintonimike_note(all_items[0]["id"], "Kiinnostaa erityisesti.")

        self.assertEqual(saved_note["id"], all_items[0]["id"])
        self.assertEqual(saved_note["noteText"], "Kiinnostaa erityisesti.")

        notes = api.list_tutkintonimike_notes()
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["id"], all_items[0]["id"])

        removed = api.remove_tutkintonimike_note(all_items[0]["id"])
        self.assertTrue(removed)
        self.assertEqual(api.list_tutkintonimike_notes(), [])

    def test_quiz_results_are_persisted_in_user_directory(self) -> None:
        api = self.create_api()
        first = api.save_quiz_result(
            "opintopolku",
            {"topPathId": "lukio", "scores": {"lukio": 3}},
        )
        second = api.save_quiz_result(
            "amis-quiz",
            {"winnerId": 2, "comparisons": 5},
        )

        all_results = api.list_quiz_results()
        self.assertEqual(len(all_results), 2)
        self.assertEqual({item["id"] for item in all_results}, {first["id"], second["id"]})

        opintopolku_results = api.list_quiz_results("opintopolku")
        self.assertEqual(len(opintopolku_results), 1)
        self.assertEqual(opintopolku_results[0]["id"], first["id"])

        results_path = self.root / "user" / "quiz_results.json"
        self.assertTrue(results_path.exists())
        payload = json.loads(results_path.read_text(encoding="utf-8"))
        self.assertEqual(len(payload["items"]), 2)

    def test_quiz_result_can_be_removed(self) -> None:
        api = self.create_api()
        result = api.save_quiz_result(
            "amis-quiz",
            {"winnerId": 2, "comparisons": 5},
        )

        removed = api.remove_quiz_result(result["id"])

        self.assertTrue(removed)
        self.assertEqual(api.list_quiz_results(), [])

    def test_quiz_session_can_be_saved_loaded_and_cleared(self) -> None:
        api = self.create_api()
        saved = api.save_quiz_session(
            "opintopolku",
            {"currentIndex": 2, "answers": [{"questionId": "q1", "optionId": "a"}]},
        )

        loaded = api.get_quiz_session("opintopolku")

        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["quizId"], "opintopolku")
        self.assertEqual(loaded["session"]["currentIndex"], 2)
        self.assertEqual(saved["updatedAt"], loaded["updatedAt"])

        cleared = api.clear_quiz_session("opintopolku")

        self.assertTrue(cleared)
        self.assertIsNone(api.get_quiz_session("opintopolku"))
        sessions_path = self.root / "user" / "quiz_sessions.json"
        self.assertTrue(sessions_path.exists())

    def test_static_server_allows_only_ui_paths(self) -> None:
        self.assertTrue(self.app.is_allowed_static_path("/src/ui/pages/home.html"))
        self.assertTrue(self.app.is_allowed_static_path("/src/ui/assets/ammatit/sahkoasentaja.png"))
        self.assertFalse(self.app.is_allowed_static_path("/src/data/ammatit.json"))
        self.assertFalse(self.app.is_allowed_static_path("/data/tutkinnot.db"))
        self.assertFalse(self.app.is_allowed_static_path("/user/quiz_results.json"))


if __name__ == "__main__":
    unittest.main()
