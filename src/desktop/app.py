"""Desktop entrypoint for digi-opo using pywebview."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

import webview


def _ui_index_path() -> str:
    project_root = Path(__file__).resolve().parents[2]
    return str(project_root / "src" / "ui" / "index.html")


def _db_path() -> Path:
    project_root = Path(__file__).resolve().parents[2]
    data_dir = project_root / "data"
    data_dir.mkdir(exist_ok=True)
    return data_dir / "ammatit.db"


def _source_json_path() -> Path:
    project_root = Path(__file__).resolve().parents[2]
    return project_root / "ammatit.json"


def _connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tutkinnot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nimi TEXT NOT NULL,
            desc TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tutkintonimikkeet (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tutkinto_id INTEGER NOT NULL,
            nimi TEXT NOT NULL,
            linkki TEXT,
            FOREIGN KEY (tutkinto_id) REFERENCES tutkinnot(id) ON DELETE CASCADE
        );
        """
    )


def _import_from_json(conn: sqlite3.Connection) -> None:
    source_path = _source_json_path()
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source data: {source_path}")

    raw_text = source_path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        # Handle trailing junk after the JSON payload.
        decoder = json.JSONDecoder()
        data, _ = decoder.raw_decode(raw_text.lstrip())

    tutkinnot = data.get("tutkinnot", [])
    if not isinstance(tutkinnot, list):
        raise ValueError("ammatit.json missing 'tutkinnot' list")

    with conn:
        for tutkinto in tutkinnot:
            nimi = str(tutkinto.get("nimi", "")).strip()
            desc = str(tutkinto.get("desc", "")).strip()
            if not nimi:
                continue
            cursor = conn.execute(
                "INSERT INTO tutkinnot (nimi, desc) VALUES (?, ?);",
                (nimi, desc),
            )
            tutkinto_id = cursor.lastrowid
            nimikkeet = tutkinto.get("tutkintonimikkeet", []) or []
            for nimike in nimikkeet:
                nimike_nimi = str(nimike.get("nimi", "")).strip()
                linkki = str(nimike.get("linkki", "")).strip() or None
                if not nimike_nimi:
                    continue
                conn.execute(
                    """
                    INSERT INTO tutkintonimikkeet (tutkinto_id, nimi, linkki)
                    VALUES (?, ?, ?);
                    """,
                    (tutkinto_id, nimike_nimi, linkki),
                )


def _ensure_data(conn: sqlite3.Connection) -> None:
    _ensure_schema(conn)
    cursor = conn.execute("SELECT COUNT(*) AS total FROM tutkinnot;")
    total = cursor.fetchone()["total"]
    if total == 0:
        _import_from_json(conn)


class Api:
    def __init__(self) -> None:
        self._conn = _connect_db()
        self._lock = threading.Lock()
        _ensure_data(self._conn)

    def list_tutkinnot(self) -> list[dict[str, str | int]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, nimi FROM tutkinnot ORDER BY nimi;"
            ).fetchall()
        return [{"id": row["id"], "nimi": row["nimi"]} for row in rows]

    def get_tutkinto(self, tutkinto_id: int) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT id, nimi, desc FROM tutkinnot WHERE id = ?;",
                (tutkinto_id,),
            ).fetchone()
        if row is None:
            return None

        with self._lock:
            nimikkeet = self._conn.execute(
                """
                SELECT nimi, linkki
                FROM tutkintonimikkeet
                WHERE tutkinto_id = ?
                ORDER BY nimi;
                """,
                (tutkinto_id,),
            ).fetchall()
        return {
            "id": row["id"],
            "nimi": row["nimi"],
            "desc": row["desc"],
            "tutkintonimikkeet": [
                {"nimi": nimike["nimi"], "linkki": nimike["linkki"]}
                for nimike in nimikkeet
            ],
        }

    def search_tutkinnot(self, query: str | None) -> list[dict[str, str | int]]:
        if not query or not str(query).strip():
            return self.list_tutkinnot()
        term = f"%{str(query).strip()}%"
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT DISTINCT t.id, t.nimi
                FROM tutkinnot t
                LEFT JOIN tutkintonimikkeet n ON n.tutkinto_id = t.id
                WHERE t.nimi LIKE ? OR t.desc LIKE ? OR n.nimi LIKE ?
                ORDER BY t.nimi;
                """,
                (term, term, term),
            ).fetchall()
        return [{"id": row["id"], "nimi": row["nimi"]} for row in rows]

    def list_tutkintonimikkeet(self) -> list[dict[str, str | int | None]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.tutkinto_id, t.nimi AS tutkinto_nimi
                FROM tutkintonimikkeet n
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                ORDER BY n.nimi;
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "nimi": row["nimi"],
                "linkki": row["linkki"],
                "tutkinto_id": row["tutkinto_id"],
                "tutkinto_nimi": row["tutkinto_nimi"],
            }
            for row in rows
        ]


def main() -> None:
    api = Api()
    webview.create_window("digi-opo", _ui_index_path(), js_api=api, width=1024, height=768)
    webview.start(gui="qt")


if __name__ == "__main__":
    main()
