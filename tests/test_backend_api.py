'''Backendin keskeisiä käyttäjäpolkuja suojaavat integraatiotestit'''

from __future__ import annotations
import importlib.util
import json
import os
import shutil
import sys
import types
import urllib.error
import urllib.request
import unittest
import uuid
from pathlib import Path
from unittest import mock


def load_app_module():
    """Lataa sovelluksen käynnistysmoduuli testikäyttöön ilman oikean käyttöliittymäikkunan avaamista"""

    project_root = Path(__file__).resolve().parents[1]
    app_path = project_root / "src" / "app" / "app.py"
    spec = importlib.util.spec_from_file_location("digi_opo_app", app_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Ei pystynyt lataamaan src/app/app.py")

    fake_webview = types.ModuleType("webview")
    setattr(fake_webview, "FileDialog", types.SimpleNamespace(SAVE=30))
    setattr(fake_webview, "create_window", lambda *args, **kwargs: None)
    setattr(fake_webview, "start", lambda *args, **kwargs: None)
    sys.modules.setdefault("webview", fake_webview)

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BackendApiTests(unittest.TestCase):
    '''Varmistaa backendin tietokanta-, sisältö- ja asetustoimintojen toimivuuden'''

    def setUp(self) -> None:
        '''Rakentaa eristetyn testiprojektin datatiedostoineen jokaista testiä varten'''

        self.app = load_app_module()
        self._apis = []
        self.test_work_dir = Path(__file__).resolve().parents[1] / ".test-work"
        self.root = self.test_work_dir / f"backend-{uuid.uuid4().hex}"
        self.root.mkdir(parents=True, exist_ok=True)
        self.user_data_root = self.root / "runtime"
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
                            "paikkakunta": ["Oulu", "Muhos"],
                        }
                    ],
                },
                {
                    "nimi": "Kokki",
                    "desc": "Ravintola- ja catering-ala",
                    "tutkintonimikkeet": [{"nimi": "Kokki", "linkki": "", "img": "", "paikkakunta": ["Muhos"]}],
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
        '''Sulkee testin aikana luodut API-instanssit ja siivoaa väliaikaiset tiedostot'''

        for api in self._apis:
            api.close()
        shutil.rmtree(self.root, ignore_errors=True)
        try:
            self.test_work_dir.rmdir()
        except OSError:
            pass

    def create_api(self):
        '''Luo API-instanssin käyttämään testin väliaikaista projektijuurta'''

        paths = self.app.ProjectPaths(
            resource_root=self.root,
            user_data_root=self.user_data_root,
        )
        with mock.patch.object(self.app, "_project_paths", return_value=paths):
            api = self.app.Api()
        self._apis.append(api)
        return api

    def test_project_paths_separate_bundled_resources_from_writable_data(self) -> None:
        paths = self.app.ProjectPaths(
            resource_root=self.root,
            user_data_root=self.user_data_root,
        )

        self.assertEqual(paths.lahde_json_path(), self.root / "src" / "data" / "ammatit.json")
        self.assertEqual(paths.opiskelu_suunnat_json_path(), self.root / "src" / "data" / "opiskeluSuunnat.json")
        self.assertEqual(paths.tietokanta_path(), self.user_data_root / "data" / "tutkinnot.db")
        self.assertEqual(paths.kayttaja_data_dir(), self.user_data_root / "user")
        self.assertEqual(paths.vienti_dir(), self.user_data_root / "exports")
        self.assertEqual(
            paths.normalize_ui_asset_ref("assets/opiskeluSuunnat/lukio.jpg"),
            "/src/ui/assets/opiskeluSuunnat/lukio.jpg",
        )

    def test_project_root_uses_pyinstaller_extraction_dir_when_frozen(self) -> None:
        bundled_root = self.root / "bundle"
        bundled_root.mkdir()

        with mock.patch.object(self.app.sys, "frozen", True, create=True), mock.patch.object(
            self.app.sys,
            "_MEIPASS",
            str(bundled_root),
            create=True,
        ):
            result = self.app.ProjectPaths(
                resource_root=bundled_root.resolve(),
                user_data_root=self.user_data_root,
            )
            self.assertEqual(result.resource_root, bundled_root.resolve())

    def test_project_paths_use_user_data_directory_when_frozen(self) -> None:
        bundled_root = self.root / "bundle"
        appdata_root = self.root / "localappdata"
        bundled_root.mkdir()

        with mock.patch.object(self.app.sys, "frozen", True, create=True), mock.patch.object(
            self.app.sys,
            "_MEIPASS",
            str(bundled_root),
            create=True,
        ), mock.patch.dict(os.environ, {"LOCALAPPDATA": str(appdata_root)}):
            paths = self.app.ProjectPaths(
                resource_root=bundled_root.resolve(),
                user_data_root=appdata_root / "digi-opo",
            )

        self.assertEqual(paths.resource_root, bundled_root.resolve())
        self.assertEqual(paths.user_data_root, appdata_root / "digi-opo")

    def test_clear_user_data_root_removes_everything_under_runtime_root(self) -> None:
        runtime_root = self.user_data_root
        (runtime_root / "user").mkdir(parents=True, exist_ok=True)
        (runtime_root / "data").mkdir(parents=True, exist_ok=True)
        (runtime_root / "exports").mkdir(parents=True, exist_ok=True)
        (runtime_root / "cache").mkdir(parents=True, exist_ok=True)

        (runtime_root / "user" / "quiz_results.json").write_text("{}", encoding="utf-8")
        (runtime_root / "data" / "tutkinnot.db").write_text("db", encoding="utf-8")
        (runtime_root / "exports" / "oma-vienti.pdf").write_bytes(b"%PDF-test")
        (runtime_root / "cache" / "temp.bin").write_bytes(b"temp")

        deleted = self.app.clear_user_data_root(runtime_root)

        deleted_paths = [path.as_posix() for path in deleted]
        self.assertIn("user/quiz_results.json", deleted_paths)
        self.assertIn("data/tutkinnot.db", deleted_paths)
        self.assertIn("exports/oma-vienti.pdf", deleted_paths)
        self.assertIn("cache/temp.bin", deleted_paths)
        self.assertEqual(list(runtime_root.iterdir()), [])

    def test_frozen_startup_wipe_prevents_legacy_saved_items_from_reappearing(self) -> None:
        legacy_saved_path = self.user_data_root / "user" / "saved_tutkintonimikkeet.json"
        legacy_saved_path.parent.mkdir(parents=True, exist_ok=True)
        legacy_saved_path.write_text(
            json.dumps({"items": [{"id": 1, "savedAt": "2026-05-25T09:00:00Z"}]}),
            encoding="utf-8",
        )

        self.app.clear_user_data_root(self.user_data_root)
        api = self.create_api()

        self.assertEqual(api.list_saved_tutkintonimikkeet(), [])
        self.assertFalse(legacy_saved_path.exists())

    
    def test_api_imports_data_and_search_works(self) -> None:
        '''Lähdedata tuodaan tietokantaan ja haku palauttaa oikeat tutkintorivit'''

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
        '''Opiskelusuuntien kuvat muunnetaan käyttöliittymälle sopiviksi HTTP-poluiksi'''

        api = self.create_api()
        items = api.list_opiskelu_suunnat()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["img"], "/src/ui/assets/opiskeluSuunnat/lukio.jpg")

    def test_opintopolku_quiz_payload_is_available(self) -> None:
        '''Opintopolkuvisan koko JSON-rakenne on saatavilla backendin kautta'''

        api = self.create_api()
        quiz = api.get_opintopolku_quiz()
        self.assertIn("questions", quiz)
        self.assertGreater(len(quiz["questions"]), 0)

    def test_saved_tutkintonimikkeet_are_persisted_in_sqlite(self) -> None:
        '''Suosikkeihin tallennettu tutkintonimike säilyy myös SQLite-tietokannassa'''

        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        saved = api.save_tutkintonimike(all_items[0]["id"])

        self.assertEqual(saved["nimi"], all_items[0]["nimi"])

        saved_items = api.list_saved_tutkintonimikkeet()
        self.assertEqual(len(saved_items), 1)
        self.assertEqual(saved_items[0]["id"], all_items[0]["id"])

        db_path = self.user_data_root / "data" / "tutkinnot.db"
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
        # Tallennettu suosikki voidaan poistaa siististi käyttäjän listalta
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        api.save_tutkintonimike(all_items[0]["id"])

        removed = api.remove_saved_tutkintonimike(all_items[0]["id"])
        self.assertTrue(removed)
        self.assertEqual(api.list_saved_tutkintonimikkeet(), [])

    def test_hidden_tutkinto_is_excluded_until_unhidden(self) -> None:
        # Piilotettu tutkinto katoaa näkyvistä, kunnes piilotus puretaan
        api = self.create_api()
        tutkinnot = api.list_tutkinnot()
        sahkoala = next(item for item in tutkinnot if item["nimi"] == "Sahkoala")

        self.assertTrue(api.hide_tutkinto(sahkoala["id"]))
        self.assertEqual([item["nimi"] for item in api.list_tutkinnot()], ["Kokki"])
        self.assertEqual(api.search_tutkinnot("sahko"), [])
        self.assertIsNone(api.get_tutkinto(sahkoala["id"]))

        hidden_tutkinnot = api.list_hidden_tutkinnot()
        self.assertEqual(len(hidden_tutkinnot), 1)
        self.assertEqual(hidden_tutkinnot[0]["nimi"], "Sahkoala")
        self.assertEqual(hidden_tutkinnot[0]["tutkintonimikeCount"], 1)
        self.assertEqual(api.list_hidden_tutkintonimikkeet(), [])

        self.assertTrue(api.unhide_tutkinto(sahkoala["id"]))
        self.assertEqual(sorted(item["nimi"] for item in api.list_tutkinnot()), ["Kokki", "Sahkoala"])
        self.assertEqual([item["nimi"] for item in api.search_tutkinnot("sahko")], ["Sahkoala"])
        self.assertIsNotNone(api.get_tutkinto(sahkoala["id"]))

    def test_hidden_tutkintonimike_is_excluded_from_lists_saved_and_notes_until_unhidden(self) -> None:
        # Piilotettu nimike poistuu myös suosikeista ja muistiinpanoista näkyvistä
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        sahkoasentaja = next(item for item in all_items if item["nimi"] == "Sahkoasentaja")
        kokki = next(item for item in all_items if item["nimi"] == "Kokki")
        api.save_tutkintonimike(sahkoasentaja["id"])
        api.save_tutkintonimike_note(sahkoasentaja["id"], "Kiinnostaa erityisesti.")

        self.assertTrue(api.hide_tutkintonimike(sahkoasentaja["id"]))

        visible_names = [item["nimi"] for item in api.list_tutkintonimikkeet()]
        self.assertEqual(visible_names, ["Kokki"])
        self.assertEqual(api.search_tutkinnot("asentaja"), [])

        sahkoala = next(item for item in api.list_tutkinnot() if item["nimi"] == "Sahkoala")
        detail = api.get_tutkinto(sahkoala["id"])
        self.assertIsNotNone(detail)
        self.assertEqual(detail["tutkintonimikkeet"], [])

        hidden_nimikkeet = api.list_hidden_tutkintonimikkeet()
        self.assertEqual(len(hidden_nimikkeet), 1)
        self.assertEqual(hidden_nimikkeet[0]["nimi"], "Sahkoasentaja")
        self.assertEqual(api.list_saved_tutkintonimikkeet(), [])
        self.assertEqual(api.list_tutkintonimike_notes(), [])

        self.assertTrue(api.unhide_tutkintonimike(sahkoasentaja["id"]))

        visible_names = sorted(item["nimi"] for item in api.list_tutkintonimikkeet())
        self.assertEqual(visible_names, ["Kokki", "Sahkoasentaja"])
        self.assertEqual([item["nimi"] for item in api.search_tutkinnot("asentaja")], ["Sahkoala"])

        detail = api.get_tutkinto(sahkoala["id"])
        self.assertIsNotNone(detail)
        self.assertEqual([item["nimi"] for item in detail["tutkintonimikkeet"]], ["Sahkoasentaja"])

        saved_names = [item["nimi"] for item in api.list_saved_tutkintonimikkeet()]
        self.assertEqual(saved_names, ["Sahkoasentaja"])
        note_names = [item["nimi"] for item in api.list_tutkintonimike_notes()]
        self.assertEqual(note_names, ["Sahkoasentaja"])
        self.assertEqual(kokki["nimi"], "Kokki")

    def test_hidden_paikkakunta_filters_items_until_unhidden(self) -> None:
        # Piilotettu paikkakunta piilottaa vain nimikkeet, joille ei jää yhtään näkyvää paikkakuntaa
        api = self.create_api()

        paikkakunnat = api.list_paikkakunnat()
        self.assertEqual([item["paikkakunta"] for item in paikkakunnat], ["Muhos", "Oulu"])

        self.assertTrue(api.hide_paikkakunta("Muhos"))

        hidden_paikkakunnat = api.list_hidden_paikkakunnat()
        self.assertEqual(len(hidden_paikkakunnat), 1)
        self.assertEqual(hidden_paikkakunnat[0]["paikkakunta"], "Muhos")
        self.assertEqual(hidden_paikkakunnat[0]["tutkintonimikeCount"], 2)

        visible_items = api.list_tutkintonimikkeet()
        self.assertEqual([item["nimi"] for item in visible_items], ["Sahkoasentaja"])
        self.assertEqual(visible_items[0]["paikkakunta"], ["Oulu"])
        self.assertEqual([item["nimi"] for item in api.search_tutkinnot("Kokki")], ["Kokki"])

        kokki_tutkinto = next(item for item in api.list_tutkinnot() if item["nimi"] == "Kokki")
        detail = api.get_tutkinto(kokki_tutkinto["id"])
        self.assertIsNotNone(detail)
        self.assertEqual(detail["tutkintonimikkeet"], [])

        self.assertTrue(api.unhide_paikkakunta("Muhos"))
        restored_names = sorted(item["nimi"] for item in api.list_tutkintonimikkeet())
        self.assertEqual(restored_names, ["Kokki", "Sahkoasentaja"])

    def test_tutkintonimike_note_can_be_saved_listed_and_removed(self) -> None:
        # Muistiinpano voidaan tallentaa, listata ja lopuksi poistaa
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

    def test_tutkintonimike_plan_can_be_saved_listed_and_cleared(self) -> None:
        # Suunnitelmatiedot tallentuvat suosikille ja voidaan myöhemmin tyhjentää
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        sahkoasentaja = next(item for item in all_items if item["nimi"] == "Sahkoasentaja")

        planned = api.save_tutkintonimike_plan(
            sahkoasentaja["id"],
            "ensisijainen",
            "haluan-selvittaa-lisaa",
            "Kysy opolta työssäoppimisesta.",
        )

        self.assertEqual(planned["id"], sahkoasentaja["id"])
        self.assertEqual(planned["planPriority"], "ensisijainen")
        self.assertEqual(planned["planStatus"], "haluan-selvittaa-lisaa")
        self.assertEqual(planned["nextStep"], "Kysy opolta työssäoppimisesta.")
        self.assertIsNotNone(planned["planUpdatedAt"])

        saved_items = api.list_saved_tutkintonimikkeet()
        self.assertEqual(len(saved_items), 1)
        self.assertEqual(saved_items[0]["planPriority"], "ensisijainen")
        self.assertEqual(saved_items[0]["planStatus"], "haluan-selvittaa-lisaa")
        self.assertEqual(saved_items[0]["nextStep"], "Kysy opolta työssäoppimisesta.")

        cleared = api.save_tutkintonimike_plan(sahkoasentaja["id"], "", "", "")
        self.assertIsNone(cleared["planPriority"])
        self.assertIsNone(cleared["planStatus"])
        self.assertIsNone(cleared["nextStep"])
        self.assertIsNone(cleared["planUpdatedAt"])

        saved_items = api.list_saved_tutkintonimikkeet()
        self.assertEqual(len(saved_items), 1)
        self.assertIsNone(saved_items[0]["planPriority"])
        self.assertIsNone(saved_items[0]["planStatus"])
        self.assertIsNone(saved_items[0]["nextStep"])

    def test_quiz_results_are_persisted_in_user_directory(self) -> None:
        # Visatulokset kirjoitetaan käyttäjän omaan tallennustiedostoon
        api = self.create_api()
        first = api.save_quiz_result(
            "opintopolku",
            {"topPathId": "lukio", "scores": {"lukio": 3}},
        )
        second = api.save_quiz_result(
            "tutkinto-kysely",
            {"winnerId": 2, "comparisons": 5},
        )

        all_results = api.list_quiz_results()
        self.assertEqual(len(all_results), 2)
        self.assertEqual({item["id"] for item in all_results}, {first["id"], second["id"]})

        opintopolku_results = api.list_quiz_results("opintopolku")
        self.assertEqual(len(opintopolku_results), 1)
        self.assertEqual(opintopolku_results[0]["id"], first["id"])

        results_path = self.user_data_root / "user" / "quiz_results.json"
        self.assertTrue(results_path.exists())
        payload = json.loads(results_path.read_text(encoding="utf-8"))
        self.assertEqual(len(payload["items"]), 2)

    def test_quiz_result_can_be_removed(self) -> None:
        # Yksittäinen visatulos voidaan poistaa tunnisteensa perusteella
        api = self.create_api()
        result = api.save_quiz_result(
            "tutkinto-kysely",
            {"winnerId": 2, "comparisons": 5},
        )

        removed = api.remove_quiz_result(result["id"])

        self.assertTrue(removed)
        self.assertEqual(api.list_quiz_results(), [])

    def test_quiz_session_can_be_saved_loaded_and_cleared(self) -> None:
        # Keskeneräinen visaistunto voidaan tallentaa, lukea ja tyhjentää
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
        sessions_path = self.user_data_root / "user" / "quiz_sessions.json"
        self.assertTrue(sessions_path.exists())

    def test_delete_user_info_removes_json_and_db_files_and_recreates_database(self) -> None:
        # Tietojen poisto poistaa user-jsonit ja data-db:t mutta jattaa backendin kayttokelpoiseksi
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        api.save_quiz_result("opintopolku", {"topPathId": "lukio"})
        api.save_quiz_session("opintopolku", {"currentIndex": 1})
        api.save_tutkintonimike(all_items[0]["id"])

        legacy_saved_path = self.user_data_root / "user" / "saved_tutkintonimikkeet.json"
        legacy_saved_path.parent.mkdir(parents=True, exist_ok=True)
        legacy_saved_path.write_text(
            json.dumps({"items": [{"id": all_items[0]["id"]}]}),
            encoding="utf-8",
        )

        results = api.delete_user_info()

        self.assertTrue(results["success"])
        self.assertCountEqual(
            results["deletedJsonFiles"],
            [
                "user/quiz_results.json",
                "user/quiz_sessions.json",
                "user/saved_tutkintonimikkeet.json",
            ],
        )
        self.assertEqual(results["deletedDbFiles"], ["data/tutkinnot.db"])
        self.assertEqual(results["deletedExportFiles"], [])
        self.assertEqual(results["deletedOtherFiles"], [])

        self.assertFalse((self.user_data_root / "user" / "quiz_results.json").exists())
        self.assertFalse((self.user_data_root / "user" / "quiz_sessions.json").exists())
        self.assertFalse(legacy_saved_path.exists())
        self.assertTrue((self.user_data_root / "data" / "tutkinnot.db").exists())
        self.assertEqual(api.list_saved_tutkintonimikkeet(), [])
        self.assertEqual(len(api.list_tutkinnot()), 2)

    def test_delete_user_info_removes_extra_runtime_files_too(self) -> None:
        api = self.create_api()
        extra_file = self.user_data_root / "cache" / "temp.bin"
        extra_file.parent.mkdir(parents=True, exist_ok=True)
        extra_file.write_bytes(b"temp")

        results = api.delete_user_info()

        self.assertIn("cache/temp.bin", results["deletedOtherFiles"])
        self.assertFalse(extra_file.exists())

    def test_export_user_data_pdf_collects_saved_data_and_writes_to_user_selected_path(self) -> None:
        # PDF-vienti kokoaa käyttäjän tiedot yhdeksi raportiksi ja käyttää exports-kansiota
        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        sahkoasentaja = next(item for item in all_items if item["nimi"] == "Sahkoasentaja")
        kokki = next(item for item in all_items if item["nimi"] == "Kokki")
        home_dir = self.root / "home"
        documents_dir = home_dir / "Documents"
        documents_dir.mkdir(parents=True, exist_ok=True)
        selected_path = documents_dir / "oma-vienti.pdf"

        api.save_tutkintonimike(sahkoasentaja["id"])
        api.save_tutkintonimike_plan(
            sahkoasentaja["id"],
            "ensisijainen",
            "vahva-vaihtoehto",
            "Kysy opolta lisää sähköalasta.",
        )
        api.save_tutkintonimike_note(sahkoasentaja["id"], "Kiinnostava vaihtoehto.")
        api.hide_tutkinto(kokki["tutkinto_id"])
        api.hide_tutkintonimike(sahkoasentaja["id"])
        api.hide_paikkakunta("Muhos")
        api.save_quiz_result("opintopolku", {"topPathId": "lukio", "scores": {"lukio": 3}})
        api.save_quiz_session("tutkinto-kysely", {"currentIndex": 2, "winnerId": 7})

        vienti_module = sys.modules.get("backend.vienti")
        self.assertIsNotNone(vienti_module)
        calls: list[tuple[str, Path]] = []
        fake_window = mock.Mock()
        fake_window.create_file_dialog.return_value = (str(selected_path),)
        api.set_window(fake_window)

        def fake_render(html: str, output_path: Path) -> None:
            calls.append((html, output_path))
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(b"%PDF-test")

        with mock.patch.object(vienti_module, "render_html_to_pdf", side_effect=fake_render), mock.patch("pathlib.Path.home", return_value=home_dir):
            result = api.export_user_data_pdf()

        self.assertTrue(result["success"])
        self.assertFalse(result["cancelled"])
        self.assertTrue(str(result["path"]).endswith(".pdf"))
        self.assertEqual(Path(result["path"]), selected_path)
        self.assertEqual(len(calls), 1)
        html, output_path = calls[0]
        self.assertEqual(output_path, Path(result["path"]))
        fake_window.create_file_dialog.assert_called_once()
        _, kwargs = fake_window.create_file_dialog.call_args
        self.assertEqual(kwargs["directory"], str(documents_dir))
        self.assertTrue(kwargs["save_filename"].endswith(".pdf"))
        self.assertIn("Käyttäjätiedot", html)
        self.assertIn("Kysy opolta lisää sähköalasta.", html)
        self.assertIn("Kiinnostava vaihtoehto.", html)
        self.assertIn("Opintopolku-kysely", html)
        self.assertNotIn("Amis-korttivertailu", html)
        self.assertIn("Kokki", html)
        self.assertIn("Piilotetut paikkakunnat", html)
        self.assertIn("Muhos", html)
        self.assertNotIn("Kesken olevat kyselyt", html)
        self.assertTrue(output_path.exists())
        self.assertEqual(result["quizResultCount"], 1)
        self.assertEqual(result["quizSessionCount"], 1)
        self.assertEqual(result["hiddenPaikkakunnatCount"], 1)

    def test_export_user_data_pdf_returns_cancelled_when_save_dialog_is_closed(self) -> None:
        '''PDF-vienti ei kirjoita tiedostoa, jos käyttäjä sulkee tallennusvalintaikkunan'''

        api = self.create_api()
        all_items = api.list_tutkintonimikkeet()
        api.save_tutkintonimike(all_items[0]["id"])
        fake_window = mock.Mock()
        fake_window.create_file_dialog.return_value = None
        api.set_window(fake_window)

        vienti_module = sys.modules.get("backend.vienti")
        self.assertIsNotNone(vienti_module)

        with mock.patch.object(vienti_module, "render_html_to_pdf") as render_mock:
            result = api.export_user_data_pdf()

        self.assertFalse(result["success"])
        self.assertTrue(result["cancelled"])
        self.assertEqual(result["path"], "")
        render_mock.assert_not_called()

    def test_static_server_allows_only_ui_paths(self) -> None:
        '''Staattinen palvelin sallii vain käyttöliittymän tiedostopolut'''

        self.assertTrue(self.app.is_allowed_static_path("/src/ui/pages/home.html"))
        self.assertTrue(self.app.is_allowed_static_path("/src/ui/assets/ammatit/sahkoasentaja.png"))
        self.assertFalse(self.app.is_allowed_static_path("/src/ui/../../src/data/ammatit.json"))
        self.assertFalse(self.app.is_allowed_static_path("/src/ui/%2e%2e/%2e%2e/src/data/ammatit.json"))
        self.assertFalse(self.app.is_allowed_static_path("/src/data/ammatit.json"))
        self.assertFalse(self.app.is_allowed_static_path("/data/tutkinnot.db"))
        self.assertFalse(self.app.is_allowed_static_path("/user/quiz_results.json"))

    def test_static_server_blocks_path_traversal_outside_ui_tree(self) -> None:
        '''Polun normalisointi ei saa sallia src/ui-kansion ulkopuolisia tiedostoja'''

        paths = self.app.ProjectPaths(
            resource_root=self.root,
            user_data_root=self.user_data_root,
        )
        server, port = self.app.start_static_server(paths)
        try:
            for request_path in (
                "/src/ui/../../src/data/ammatit.json",
                "/src/ui/%2e%2e/%2e%2e/src/data/ammatit.json",
            ):
                with self.subTest(request_path=request_path):
                    with self.assertRaises(urllib.error.HTTPError) as ctx:
                        urllib.request.urlopen(f"http://127.0.0.1:{port}{request_path}")
                    self.assertEqual(ctx.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
