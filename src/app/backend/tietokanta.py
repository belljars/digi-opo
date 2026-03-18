from __future__ import annotations

import sqlite3

from backend_apu import (
    laske_sha256,
    lue_json_objekti,
    parse_json_payload,
    utc_now_iso,
)
from projekti_paths import ProjectPaths


AMMATIT_IMPORT_VERSION = "4"


def connect_db(paths: ProjectPaths) -> sqlite3.Connection:
    # Avaa yhteyden sovelluksen SQLite-tietokantaan
    conn = sqlite3.connect(paths.tietokanta_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    # Luo sovelluksen tarvitsemat taulut ja puuttuvat sarakkeet
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
            img TEXT,
            FOREIGN KEY (tutkinto_id) REFERENCES tutkinnot(id) ON DELETE CASCADE
        );
        """
    )

    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(tutkintonimikkeet);").fetchall()
    }

    if "img" not in columns:
        conn.execute("ALTER TABLE tutkintonimikkeet ADD COLUMN img TEXT;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_tutkintonimikkeet (
            tutkintonimike_id INTEGER PRIMARY KEY,
            saved_at TEXT NOT NULL,
            FOREIGN KEY (tutkintonimike_id) REFERENCES tutkintonimikkeet(id) ON DELETE CASCADE
        );
        """
    )

    saved_columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(saved_tutkintonimikkeet);").fetchall()
    }

    if "plan_priority" not in saved_columns:
        conn.execute("ALTER TABLE saved_tutkintonimikkeet ADD COLUMN plan_priority TEXT;")
    if "plan_status" not in saved_columns:
        conn.execute("ALTER TABLE saved_tutkintonimikkeet ADD COLUMN plan_status TEXT;")
    if "next_step" not in saved_columns:
        conn.execute("ALTER TABLE saved_tutkintonimikkeet ADD COLUMN next_step TEXT;")
    if "plan_updated_at" not in saved_columns:
        conn.execute("ALTER TABLE saved_tutkintonimikkeet ADD COLUMN plan_updated_at TEXT;")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS hidden_tutkinnot (
            tutkinto_id INTEGER PRIMARY KEY,
            hidden_at TEXT NOT NULL,
            FOREIGN KEY (tutkinto_id) REFERENCES tutkinnot(id) ON DELETE CASCADE
        );
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS hidden_tutkintonimikkeet (
            tutkintonimike_id INTEGER PRIMARY KEY,
            hidden_at TEXT NOT NULL,
            FOREIGN KEY (tutkintonimike_id) REFERENCES tutkintonimikkeet(id) ON DELETE CASCADE
        );
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tutkintonimike_notes (
            tutkintonimike_id INTEGER PRIMARY KEY,
            note_text TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (tutkintonimike_id) REFERENCES tutkintonimikkeet(id) ON DELETE CASCADE
        );
        """
    )


def import_tutkinnot(conn: sqlite3.Connection, paths: ProjectPaths, tutkinnot: list) -> None:
    # Tuo tutkintodata SQLiteen lahde-JSONista
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
            img = paths.normalize_ui_asset_ref(str(nimike.get("img", "")).strip()) or None
            if not nimike_nimi:
                continue
            conn.execute(
                """
                INSERT INTO tutkintonimikkeet (tutkinto_id, nimi, linkki, img)
                VALUES (?, ?, ?, ?);
                """,
                (tutkinto_id, nimike_nimi, linkki, img),
            )


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    # Hakee metataulusta yhden arvon avaimella
    row = conn.execute("SELECT value FROM app_meta WHERE key = ?;", (key,)).fetchone()
    return row["value"] if row else None


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    # Tallentaa metatauluun avain-arvo-parin
    conn.execute(
        """
        INSERT INTO app_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """,
        (key, value),
    )


def ensure_data(conn: sqlite3.Connection, paths: ProjectPaths) -> None:
    # Varmistaa, etta tietokanta vastaa nykyista lahde-JSONia
    ensure_schema(conn)
    source_path = paths.lahde_json_path()
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source data: {source_path}")

    raw_text = source_path.read_text(encoding="utf-8")
    data = parse_json_payload(raw_text, "ammatit.json")
    tutkinnot = data.get("tutkinnot", [])
    if not isinstance(tutkinnot, list):
        raise ValueError("ammatit.json missing 'tutkinnot' list")

    source_hash = laske_sha256(raw_text)
    import_signature = f"{AMMATIT_IMPORT_VERSION}:{source_hash}"
    total = conn.execute("SELECT COUNT(*) AS total FROM tutkinnot;").fetchone()["total"]
    current_hash = get_meta(conn, "ammatit_json_sha256")

    if total == 0 or current_hash != import_signature:
        with conn:
            conn.execute("DELETE FROM tutkintonimikkeet;")
            conn.execute("DELETE FROM tutkinnot;")
            import_tutkinnot(conn, paths, tutkinnot)
            set_meta(conn, "ammatit_json_sha256", import_signature)


def migrate_saved_tutkintonimikkeet_from_json(
    conn: sqlite3.Connection, paths: ProjectPaths
) -> None:
    # Siirtaa vanhat JSON-suosikit kerran SQLite-tallennukseen
    legacy_path = paths.saved_tutkintonimikkeet_path()
    if not legacy_path.exists():
        return

    data = lue_json_objekti(legacy_path, {"items": []})
    items = data.get("items", [])
    if not isinstance(items, list) or not items:
        return

    with conn:
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                tutkintonimike_id = int(item.get("id", 0))
            except (TypeError, ValueError):
                continue
            if tutkintonimike_id <= 0:
                continue
            saved_at = str(item.get("savedAt", "")).strip() or utc_now_iso()
            exists = conn.execute(
                "SELECT 1 FROM tutkintonimikkeet WHERE id = ?;",
                (tutkintonimike_id,),
            ).fetchone()
            if not exists:
                continue
            conn.execute(
                """
                INSERT INTO saved_tutkintonimikkeet (tutkintonimike_id, saved_at)
                VALUES (?, ?)
                ON CONFLICT(tutkintonimike_id) DO NOTHING;
                """,
                (tutkintonimike_id, saved_at),
            )
    legacy_path.unlink(missing_ok=True)
