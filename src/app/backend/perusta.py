from __future__ import annotations

import sqlite3
import threading

from backend_apu import kirjoita_json_objekti, lue_json_objekti, utc_now_iso
from projekti_paths import ProjectPaths

from .tietokanta import connect_db, ensure_data, migrate_saved_tutkintonimikkeet_from_json


class BackendBase:
    _paths: ProjectPaths
    _conn: sqlite3.Connection
    _lock: threading.Lock
    _closed: bool

    def __init__(self, paths: ProjectPaths) -> None:
        # Luo backend-API:n, tietokantayhteyden ja varmistaa datan
        self._paths = paths
        self._conn = connect_db(paths)
        self._lock = threading.Lock()
        self._closed = False
        ensure_data(self._conn, self._paths)
        migrate_saved_tutkintonimikkeet_from_json(self._conn, self._paths)

    def close(self) -> None:
        # Sulkee tietokantayhteyden hallitusti sovelluksen tai testin lopussa
        with self._lock:
            if self._closed:
                return
            self._conn.close()
            self._closed = True

    def _load_quiz_results(self) -> list[dict]:
        # Lukee tallennetut quiz-tulokset kayttajan JSON-tiedostosta
        data = lue_json_objekti(self._paths.quiz_vastaus_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_results(self, items: list[dict]) -> None:
        # Kirjoittaa quiz-tulokset levylle
        kirjoita_json_objekti(
            self._paths.quiz_vastaus_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )

    def _load_quiz_sessions(self) -> list[dict]:
        # Lukee keskeneraiset quiz-istunnot kayttajan JSON-tiedostosta
        data = lue_json_objekti(self._paths.quiz_tila_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_sessions(self, items: list[dict]) -> None:
        # Kirjoittaa quiz-istunnot levylle
        kirjoita_json_objekti(
            self._paths.quiz_tila_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )
