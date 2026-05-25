'''Backendin perusluokka, joka avaa tietokantayhteyden ja tarjoaa apumetodeja datan lukemiseen ja kirjoittamiseen'''

from __future__ import annotations

import sqlite3
import threading
from typing import Any

from backend_apu import (
    kirjoita_json_objekti,
    lue_json_objekti,
    utc_now_iso,
)
from projekti_paths import ProjectPaths, clear_user_data_root

from .tietokanta import (
    connect_db,
    ensure_data,
    migrate_saved_tutkintonimikkeet_from_json,
)


class BackendBase:
    '''Backendin kantaluokka, jonka paalle muut mixinit rakentuvat'''

    _paths: ProjectPaths
    _conn: sqlite3.Connection
    _lock: threading.Lock
    _closed: bool
    _window: Any | None

    def __init__(self, paths: ProjectPaths) -> None:
        '''Alustaa backendin ja avaa tietokantayhteyden'''

        self._paths = paths
        self._conn = connect_db(paths)
        self._lock = threading.Lock()
        self._closed = False
        self._window = None
        ensure_data(self._conn, self._paths)
        migrate_saved_tutkintonimikkeet_from_json(self._conn, self._paths)

    def set_window(self, window: Any) -> None:
        '''Tallentaa pywebview-ikkunan, jotta backend voi avata natiivivalintaikkunoita'''
        
        self._window = window

    def close(self) -> None:
        '''Sulkee tietokantayhteyden ja merkitsee backendin suljetuksi'''

        with self._lock:
            if self._closed:
                return
            self._conn.close()
            self._closed = True

    def _load_quiz_results(self) -> list[dict]:
        data = lue_json_objekti(self._paths.quiz_vastaus_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_results(self, items: list[dict]) -> None:
        kirjoita_json_objekti(
            self._paths.quiz_vastaus_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )

    def _load_quiz_sessions(self) -> list[dict]:
        data = lue_json_objekti(self._paths.quiz_tila_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_sessions(self, items: list[dict]) -> None:
        '''Kirjoittaa keskeneraiset visaistunnot levylle aikaleiman kanssa'''

        kirjoita_json_objekti(
            self._paths.quiz_tila_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )

    def delete_user_info(self) -> dict[str, list[str] | bool]:
        '''Poistaa sovelluksen kirjoitettavan datajuuren kayttajatiedot ja tietokantatiedostot'''

        writable_root = self._paths.user_data_root
        if writable_root is None:
            raise ValueError("User data root is not configured")
        writable_root = writable_root.resolve()

        deleted_json: list[str] = []
        deleted_db: list[str] = []
        deleted_exports: list[str] = []
        deleted_other: list[str] = []

        with self._lock:
            self._conn.close()
            deleted_entries = clear_user_data_root(writable_root)
            for relative_path in deleted_entries:
                relative_text = relative_path.as_posix()
                file_name = relative_path.name
                if file_name.endswith(".db") or ".db-" in file_name:
                    deleted_db.append(relative_text)
                elif relative_path.suffix == ".json":
                    deleted_json.append(relative_text)
                elif relative_path.suffix == ".pdf":
                    deleted_exports.append(relative_text)
                elif relative_text:
                    deleted_other.append(relative_text)
            self._conn = connect_db(self._paths)
            ensure_data(self._conn, self._paths)

        return {
            "success": True,
            "deletedJsonFiles": deleted_json,
            "deletedDbFiles": deleted_db,
            "deletedExportFiles": deleted_exports,
            "deletedOtherFiles": deleted_other,
        }
