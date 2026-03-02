from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

# Avoid known Qt Wayland EGL crashes in some Linux environments by defaulting
# to XWayland unless the user has explicitly selected a Qt platform.
if sys.platform.startswith("linux") and os.environ.get("WAYLAND_DISPLAY"):
    os.environ.setdefault("QT_QPA_PLATFORM", "xcb")

import webview


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _ui_index_path() -> str:
    return "/src/ui/pages/home.html"


def _db_path() -> Path:
    data_dir = _project_root() / "data"
    data_dir.mkdir(exist_ok=True)
    return data_dir / "tutkinnot.db"


def _source_json_path() -> Path:
    return _project_root() / "src" / "data" / "ammatit.json"


def _opiskelu_suunnat_json_path() -> Path:
    return _project_root() / "src" / "data" / "opiskeluSuunnat.json"


def _opintopolku_quiz_json_path() -> Path:
    return _project_root() / "src" / "data" / "opintopolkuQuiz.json"


def _resolve_local_ui_path(raw_path: str) -> Path | None:
    candidate_text = str(raw_path or "").strip()
    if not candidate_text:
        return None

    # Leave URLs (http/file/data/etc.) untouched.
    if urlparse(candidate_text).scheme:
        return None

    normalized = candidate_text.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    while normalized.startswith("../"):
        normalized = normalized[3:]
    normalized = normalized.lstrip("/")

    if not normalized:
        return None

    project_root = _project_root()
    rel_candidates = [Path(normalized)]

    if normalized.startswith("src/ui/"):
        rel_candidates.append(Path(normalized.removeprefix("src/ui/")))
    elif normalized.startswith("ui/"):
        rel_candidates.append(Path(normalized.removeprefix("ui/")))

    for rel in list(rel_candidates):
        rel_candidates.append(Path("src/ui") / rel)

    seen: set[Path] = set()
    for rel in rel_candidates:
        if rel in seen:
            continue
        seen.add(rel)
        abs_path = project_root / rel
        if abs_path.exists():
            return abs_path
    return None


def _normalize_ui_asset_ref(raw_path: str) -> str:
    resolved = _resolve_local_ui_path(raw_path)
    if not resolved:
        return raw_path

    try:
        rel = resolved.relative_to(_project_root()).as_posix()
        return f"/{rel}"
    except ValueError:
        return raw_path


def _connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _start_static_server() -> tuple[ThreadingHTTPServer, int]:
    handler = partial(SimpleHTTPRequestHandler, directory=str(_project_root()))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, server.server_port


def _parse_json_payload(raw_text: str, source_name: str) -> dict:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        # Käsittelee JSON-payloadin jälkeiset roskat.
        decoder = json.JSONDecoder()
        data, _ = decoder.raw_decode(raw_text.lstrip())

    if not isinstance(data, dict):
        raise ValueError(f"{source_name} root payload must be an object")
    return data


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )


def _import_tutkinnot(conn: sqlite3.Connection, tutkinnot: list) -> None:
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
        if not isinstance(nimikkeet, list):
            nimikkeet = []
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


def _get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM app_meta WHERE key = ?;", (key,)).fetchone()
    return row["value"] if row else None


def _set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        """
        INSERT INTO app_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """,
        (key, value),
    )


def _ensure_data(conn: sqlite3.Connection) -> None:
    _ensure_schema(conn)
    source_path = _source_json_path()
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source data: {source_path}")

    raw_text = source_path.read_text(encoding="utf-8")
    data = _parse_json_payload(raw_text, "ammatit.json")
    tutkinnot = data.get("tutkinnot", [])
    if not isinstance(tutkinnot, list):
        raise ValueError("ammatit.json missing 'tutkinnot' list")

    source_hash = _sha256(raw_text)
    total = conn.execute("SELECT COUNT(*) AS total FROM tutkinnot;").fetchone()["total"]
    current_hash = _get_meta(conn, "ammatit_json_sha256")

    if total == 0 or current_hash != source_hash:
        with conn:
            conn.execute("DELETE FROM tutkintonimikkeet;")
            conn.execute("DELETE FROM tutkinnot;")
            _import_tutkinnot(conn, tutkinnot)
            _set_meta(conn, "ammatit_json_sha256", source_hash)


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

    def list_opiskelu_suunnat(self) -> list[dict[str, str | int]]:
        source_path = _opiskelu_suunnat_json_path()
        if not source_path.exists():
            raise FileNotFoundError(f"Missing source data: {source_path}")

        raw_text = source_path.read_text(encoding="utf-8")
        data = _parse_json_payload(raw_text, "opiskeluSuunnat.json")

        opiskelu_suunnat = data.get("opiskeluSuunnat", [])
        if not isinstance(opiskelu_suunnat, list):
            raise ValueError("opiskeluSuunnat.json missing 'opiskeluSuunnat' list")

        items: list[dict[str, str | int]] = []
        for item in opiskelu_suunnat:
            if not isinstance(item, dict):
                continue
            nimi = str(item.get("nimi", "")).strip()
            if not nimi:
                continue

            raw_id = item.get("id", 0)
            try:
                item_id = int(raw_id)
            except (TypeError, ValueError):
                item_id = 0

            items.append(
                {
                    "id": item_id,
                    "img": _normalize_ui_asset_ref(str(item.get("img", "")).strip()),
                    "nimi": nimi,
                    "desc": str(item.get("desc", "")).strip(),
                    "kenelle": str(item.get("kenelle", "")).strip(),
                }
            )
        return items

    def get_opintopolku_quiz(self) -> dict:
        source_path = _opintopolku_quiz_json_path()
        if not source_path.exists():
            raise FileNotFoundError(f"Missing source data: {source_path}")

        raw_text = source_path.read_text(encoding="utf-8")
        data = _parse_json_payload(raw_text, "opintopolkuQuiz.json")
        if not isinstance(data, dict):
            raise ValueError("opintopolkuQuiz.json root payload must be an object")
        return data


def main() -> None:
    api = Api()
    server, port = _start_static_server()
    try:
        webview.create_window(
            "digi-opo",
            f"http://127.0.0.1:{port}{_ui_index_path()}",
            js_api=api,
            width=1024,
            height=768,
        )
        webview.start(gui="qt")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
