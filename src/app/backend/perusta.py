# Backendin perusrakenne ja yhteiset tallennusapumetodit

# Perusluokka avaa tietokantayhteyden, varmistaa lahdedatan saatavuuden ja tarjoaa
# yhteiset metodit visatietojen tallentamiseen tiedostoihin

from __future__ import annotations

from pathlib import Path
import sqlite3
import threading
from typing import Any

from backend_apu import (
    kirjoita_json_objekti,
    lue_json_objekti,
    utc_now_iso,
)
from projekti_paths import ProjectPaths

from .tietokanta import (
    connect_db,
    ensure_data,
    migrate_saved_tutkintonimikkeet_from_json,
)


class BackendBase:
    # Backendin kantaluokka, jonka paalle muut mixinit rakentuvat

    _paths: ProjectPaths
    _conn: sqlite3.Connection
    _lock: threading.Lock
    _closed: bool
    _window: Any | None

    def __init__(self, paths: ProjectPaths) -> None:
        # Avaa tietokannan ja varmistaa, etta sovelluksen data on kayttovalmista
        self._paths = paths
        self._conn = connect_db(paths)
        self._lock = threading.Lock()
        self._closed = False
        self._window = None
        ensure_data(self._conn, self._paths)
        migrate_saved_tutkintonimikkeet_from_json(self._conn, self._paths)

    def set_window(self, window: Any) -> None:
        # Tallentaa pywebview-ikkunan, jotta backend voi avata natiivivalintaikkunoita.
        self._window = window

    def close(self) -> None:
        # Sulkee tietokantayhteyden hallitusti sovelluksen tai testin lopussa
        with self._lock:
            if self._closed:
                return
            self._conn.close()
            self._closed = True

    def _load_quiz_results(self) -> list[dict]:
        # Lukee tallennetut visatulokset kayttajan JSON-tiedostosta
        data = lue_json_objekti(self._paths.quiz_vastaus_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_results(self, items: list[dict]) -> None:
        # Kirjoittaa visatulokset levylle aikaleiman kanssa
        kirjoita_json_objekti(
            self._paths.quiz_vastaus_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )

    def _load_quiz_sessions(self) -> list[dict]:
        # Lukee keskeneraiset visaistunnot kayttajan JSON-tiedostosta
        data = lue_json_objekti(self._paths.quiz_tila_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_sessions(self, items: list[dict]) -> None:
        # Kirjoittaa keskeneraiset visaistunnot levylle aikaleiman kanssa
        kirjoita_json_objekti(
            self._paths.quiz_tila_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )

    def delete_user_info(self) -> dict[str, list[str] | bool]:
        # Poistaa vain sovelluksen kirjoitettavan datajuuren JSON- ja DB-tiedostot
        user_dir = self._paths.kayttaja_data_dir().resolve()
        data_dir = self._paths.tietokanta_path().resolve().parent
        writable_root = self._paths.user_data_root.resolve()

        deleted_json: list[str] = []
        deleted_db: list[str] = []

        def _delete_matching_files(base_dir: Path, pattern: str, deleted: list[str]) -> None:
            resolved_base = base_dir.resolve()
            if writable_root not in resolved_base.parents and resolved_base != writable_root:
                raise ValueError("Delete target is outside writable data root")
            if not resolved_base.exists():
                return

            for file_path in resolved_base.glob(pattern):
                resolved_file = file_path.resolve()
                if resolved_file.parent != resolved_base or not resolved_file.is_file():
                    continue
                resolved_file.unlink()
                deleted.append(resolved_file.name)

        with self._lock: # Varmistetaan, etta tietokantayhteyden sulkeminen ja uudelleenavaaminen tapahtuu hallitusti
            _delete_matching_files(user_dir, "*.json", deleted_json)
            self._conn.close()
            _delete_matching_files(data_dir, "*.db", deleted_db)
            self._conn = connect_db(self._paths)
            ensure_data(self._conn, self._paths)
            migrate_saved_tutkintonimikkeet_from_json(self._conn, self._paths)

        return {
            "success": True,
            "deletedJsonFiles": deleted_json,
            "deletedDbFiles": deleted_db,
        }
