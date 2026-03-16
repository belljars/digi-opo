from __future__ import annotations

import json
import sqlite3
import threading

from backend_apu import (
    parse_json_payload,
    kirjoita_json_objekti,
    laske_sha256,
    lue_json_objekti,
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
        CREATE TABLE IF NOT EXISTS saved_tutkintonimikkeet (
            tutkintonimike_id INTEGER PRIMARY KEY,
            saved_at TEXT NOT NULL,
            FOREIGN KEY (tutkintonimike_id) REFERENCES tutkintonimikkeet(id) ON DELETE CASCADE
        );
        """
    )

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


def migrate_saved_tutkintonimikkeet_from_json(conn: sqlite3.Connection, paths: ProjectPaths) -> None:

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


class Api:
    def __init__(self, paths: ProjectPaths) -> None:
        # Luo backend-API:n, tietokantayhteyden ja varmistaa datan
        self._paths = paths
        self._conn = connect_db(paths)
        self._lock = threading.Lock()
        ensure_data(self._conn, self._paths)
        migrate_saved_tutkintonimikkeet_from_json(self._conn, self._paths)

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

    def list_tutkinnot(self) -> list[dict[str, str | int]]:
        # Palauttaa kaikki nakyvat tutkinnot listanakymaa varten
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT t.id, t.nimi
                FROM tutkinnot t
                LEFT JOIN hidden_tutkinnot h ON h.tutkinto_id = t.id
                WHERE h.tutkinto_id IS NULL
                ORDER BY t.nimi;
                """
            ).fetchall()
        return [{"id": row["id"], "nimi": row["nimi"]} for row in rows]

    def get_tutkinto(self, tutkinto_id: int) -> dict | None:
        # Hakee yhden tutkinnon tiedot ja siihen kuuluvat nakyvat nimikkeet
        with self._lock:
            row = self._conn.execute(
                """
                SELECT t.id, t.nimi, t.desc
                FROM tutkinnot t
                LEFT JOIN hidden_tutkinnot h ON h.tutkinto_id = t.id
                WHERE t.id = ? AND h.tutkinto_id IS NULL;
                """,
                (tutkinto_id,),
            ).fetchone()
        if row is None:
            return None

        with self._lock:
            nimikkeet = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.img
                FROM tutkintonimikkeet n
                LEFT JOIN hidden_tutkintonimikkeet h ON h.tutkintonimike_id = n.id
                WHERE n.tutkinto_id = ? AND h.tutkintonimike_id IS NULL
                ORDER BY n.nimi;
                """,
                (tutkinto_id,),
            ).fetchall()
        return {
            "id": row["id"],
            "nimi": row["nimi"],
            "desc": row["desc"],
            "tutkintonimikkeet": [
                {
                    "id": nimike["id"],
                    "nimi": nimike["nimi"],
                    "linkki": nimike["linkki"],
                    "img": nimike["img"],
                }
                for nimike in nimikkeet
            ],
        }

    def search_tutkinnot(self, query: str | None) -> list[dict[str, str | int]]:
        # Hakee tutkintoja nimen, kuvauksen tai nimikkeen perusteella
        if not query or not str(query).strip():
            return self.list_tutkinnot()
        term = f"%{str(query).strip()}%"
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT DISTINCT t.id, t.nimi
                FROM tutkinnot t
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN tutkintonimikkeet n ON n.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                WHERE ht.tutkinto_id IS NULL
                  AND (
                    t.nimi LIKE ?
                    OR t.desc LIKE ?
                    OR (hn.tutkintonimike_id IS NULL AND n.nimi LIKE ?)
                  )
                ORDER BY t.nimi;
                """,
                (term, term, term),
            ).fetchall()
        return [{"id": row["id"], "nimi": row["nimi"]} for row in rows]

    def list_tutkintonimikkeet(self) -> list[dict[str, str | int | None]]:
        # Palauttaa kaikki nakyvat tutkintonimikkeet yhdessa listassa
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.img, n.tutkinto_id, t.nimi AS tutkinto_nimi
                FROM tutkintonimikkeet n
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                WHERE ht.tutkinto_id IS NULL AND hn.tutkintonimike_id IS NULL
                ORDER BY n.nimi;
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "nimi": row["nimi"],
                "linkki": row["linkki"],
                "img": row["img"],
                "tutkinto_id": row["tutkinto_id"],
                "tutkinto_nimi": row["tutkinto_nimi"],
            }
            for row in rows
        ]

    def list_saved_tutkintonimikkeet(self) -> list[dict]:

        # Palauttaa kayttajan tallentamat ja edelleen nakyvat suosikit
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.img, n.tutkinto_id, t.nimi AS tutkinto_nimi, s.saved_at
                FROM saved_tutkintonimikkeet s
                JOIN tutkintonimikkeet n ON n.id = s.tutkintonimike_id
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                WHERE ht.tutkinto_id IS NULL AND hn.tutkintonimike_id IS NULL
                ORDER BY n.nimi;
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "nimi": row["nimi"],
                "linkki": row["linkki"],
                "img": row["img"],
                "tutkinto_id": row["tutkinto_id"],
                "tutkinto_nimi": row["tutkinto_nimi"],
                "savedAt": row["saved_at"],
            }
            for row in rows
        ]

    def save_tutkintonimike(self, tutkintonimike_id: int) -> dict:
        # Tallentaa tutkintonimikkeen suosikkeihin
        try:
            nimike_id = int(tutkintonimike_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkintonimike id") from exc

        with self._lock:
            row = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.img, n.tutkinto_id, t.nimi AS tutkinto_nimi
                FROM tutkintonimikkeet n
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                WHERE n.id = ? AND ht.tutkinto_id IS NULL AND hn.tutkintonimike_id IS NULL;
                """,
                (nimike_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Unknown tutkintonimike id: {nimike_id}")
            existing = self._conn.execute(
                """
                SELECT saved_at
                FROM saved_tutkintonimikkeet
                WHERE tutkintonimike_id = ?;
                """,
                (nimike_id,),
            ).fetchone()
            saved_at = existing["saved_at"] if existing else utc_now_iso()
            item = {
                "id": row["id"],
                "nimi": row["nimi"],
                "linkki": row["linkki"],
                "img": row["img"],
                "tutkinto_id": row["tutkinto_id"],
                "tutkinto_nimi": row["tutkinto_nimi"],
                "savedAt": saved_at,
            }
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO saved_tutkintonimikkeet (tutkintonimike_id, saved_at)
                    VALUES (?, ?)
                    ON CONFLICT(tutkintonimike_id) DO NOTHING;
                    """,
                    (nimike_id, saved_at),
                )
        return item

    def remove_saved_tutkintonimike(self, tutkintonimike_id: int) -> bool:
        # Poistaa tutkintonimikkeen suosikeista
        try:
            nimike_id = int(tutkintonimike_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkintonimike id") from exc

        with self._lock:
            with self._conn:
                cursor = self._conn.execute(
                    """
                    DELETE FROM saved_tutkintonimikkeet
                    WHERE tutkintonimike_id = ?;
                    """,
                    (nimike_id,),
                )
        return cursor.rowcount > 0

    def list_tutkintonimike_notes(self) -> list[dict]:
        # Listaa tutkintonimikkeisiin liitetyt muistiinpanot
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.img, n.tutkinto_id, t.nimi AS tutkinto_nimi, notes.note_text, notes.updated_at
                FROM tutkintonimike_notes notes
                JOIN tutkintonimikkeet n ON n.id = notes.tutkintonimike_id
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                WHERE ht.tutkinto_id IS NULL AND hn.tutkintonimike_id IS NULL
                ORDER BY notes.updated_at DESC, n.nimi;
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "nimi": row["nimi"],
                "linkki": row["linkki"],
                "img": row["img"],
                "tutkinto_id": row["tutkinto_id"],
                "tutkinto_nimi": row["tutkinto_nimi"],
                "noteText": row["note_text"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]

    def save_tutkintonimike_note(self, tutkintonimike_id: int, note_text: str) -> dict:
        # Tallentaa tai paivittaa tutkintonimikkeen muistiinpanon
        try:
            nimike_id = int(tutkintonimike_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkintonimike id") from exc

        normalized_note = str(note_text or "").strip()
        if not normalized_note:
            raise ValueError("note_text is required")

        with self._lock:
            row = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.img, n.tutkinto_id, t.nimi AS tutkinto_nimi
                FROM tutkintonimikkeet n
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                WHERE n.id = ? AND ht.tutkinto_id IS NULL AND hn.tutkintonimike_id IS NULL;
                """,
                (nimike_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Unknown tutkintonimike id: {nimike_id}")

            updated_at = utc_now_iso()
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO tutkintonimike_notes (tutkintonimike_id, note_text, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(tutkintonimike_id) DO UPDATE
                    SET note_text = excluded.note_text, updated_at = excluded.updated_at;
                    """,
                    (nimike_id, normalized_note, updated_at),
                )

        return {
            "id": row["id"],
            "nimi": row["nimi"],
            "linkki": row["linkki"],
            "img": row["img"],
            "tutkinto_id": row["tutkinto_id"],
            "tutkinto_nimi": row["tutkinto_nimi"],
            "noteText": normalized_note,
            "updatedAt": updated_at,
        }

    def remove_tutkintonimike_note(self, tutkintonimike_id: int) -> bool:
        # Poistaa tutkintonimikkeen muistiinpanon
        
        try:
            nimike_id = int(tutkintonimike_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkintonimike id") from exc

        with self._lock:
            with self._conn:
                cursor = self._conn.execute(
                    """
                    DELETE FROM tutkintonimike_notes
                    WHERE tutkintonimike_id = ?;
                    """,
                    (nimike_id,),
                )
        return cursor.rowcount > 0

    def list_hidden_tutkinnot(self) -> list[dict[str, str | int]]:
        # Palauttaa asetuksissa piilotetut tutkinnot
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT t.id, t.nimi, h.hidden_at, COUNT(n.id) AS tutkintonimike_count
                FROM hidden_tutkinnot h
                JOIN tutkinnot t ON t.id = h.tutkinto_id
                LEFT JOIN tutkintonimikkeet n ON n.tutkinto_id = t.id
                GROUP BY t.id, t.nimi, h.hidden_at
                ORDER BY t.nimi;
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "nimi": row["nimi"],
                "hiddenAt": row["hidden_at"],
                "tutkintonimikeCount": row["tutkintonimike_count"],
            }
            for row in rows
        ]

    def list_hidden_tutkintonimikkeet(self) -> list[dict[str, str | int | None]]:
        # Palauttaa asetuksissa piilotetut tutkintonimikkeet
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT n.id, n.nimi, n.linkki, n.img, n.tutkinto_id, t.nimi AS tutkinto_nimi, h.hidden_at
                FROM hidden_tutkintonimikkeet h
                JOIN tutkintonimikkeet n ON n.id = h.tutkintonimike_id
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                WHERE ht.tutkinto_id IS NULL
                ORDER BY n.nimi;
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "nimi": row["nimi"],
                "linkki": row["linkki"],
                "img": row["img"],
                "tutkinto_id": row["tutkinto_id"],
                "tutkinto_nimi": row["tutkinto_nimi"],
                "hiddenAt": row["hidden_at"],
            }
            for row in rows
        ]

    def hide_tutkinto(self, tutkinto_id: int) -> bool:
        # Piilottaa tutkinnon koko sovelluksesta
        try:
            normalized_id = int(tutkinto_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkinto id") from exc

        with self._lock:
            exists = self._conn.execute(
                "SELECT 1 FROM tutkinnot WHERE id = ?;",
                (normalized_id,),
            ).fetchone()
            if not exists:
                raise ValueError(f"Unknown tutkinto id: {normalized_id}")
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO hidden_tutkinnot (tutkinto_id, hidden_at)
                    VALUES (?, ?)
                    ON CONFLICT(tutkinto_id) DO UPDATE SET hidden_at = excluded.hidden_at;
                    """,
                    (normalized_id, utc_now_iso()),
                )
        return True

    def unhide_tutkinto(self, tutkinto_id: int) -> bool:
        # Palauttaa aiemmin piilotetun tutkinnon takaisin nakyviin
        try:
            normalized_id = int(tutkinto_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkinto id") from exc

        with self._lock:
            with self._conn:
                cursor = self._conn.execute(
                    """
                    DELETE FROM hidden_tutkinnot
                    WHERE tutkinto_id = ?;
                    """,
                    (normalized_id,),
                )
        return cursor.rowcount > 0

    def hide_tutkintonimike(self, tutkintonimike_id: int) -> bool:
        # Piilottaa yksittaisen tutkintonimikkeen koko sovelluksesta
        try:
            normalized_id = int(tutkintonimike_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkintonimike id") from exc

        with self._lock:
            exists = self._conn.execute(
                """
                SELECT n.id
                FROM tutkintonimikkeet n
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                WHERE n.id = ? AND ht.tutkinto_id IS NULL;
                """,
                (normalized_id,),
            ).fetchone()
            if not exists:
                raise ValueError(f"Unknown tutkintonimike id: {normalized_id}")
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO hidden_tutkintonimikkeet (tutkintonimike_id, hidden_at)
                    VALUES (?, ?)
                    ON CONFLICT(tutkintonimike_id) DO UPDATE SET hidden_at = excluded.hidden_at;
                    """,
                    (normalized_id, utc_now_iso()),
                )
        return True

    def unhide_tutkintonimike(self, tutkintonimike_id: int) -> bool:
        # Palauttaa aiemmin piilotetun tutkintonimikkeen takaisin nakyviin
        try:
            normalized_id = int(tutkintonimike_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkintonimike id") from exc

        with self._lock:
            with self._conn:
                cursor = self._conn.execute(
                    """
                    DELETE FROM hidden_tutkintonimikkeet
                    WHERE tutkintonimike_id = ?;
                    """,
                    (normalized_id,),
                )
        return cursor.rowcount > 0

    def list_quiz_results(self, quiz_id: str | None = None) -> list[dict]:
        # Lukee quiz-tulokset ja suodattaa ne tarvittaessa quizin tunnisteella
        normalized_quiz_id = str(quiz_id or "").strip()
        with self._lock:
            items = self._load_quiz_results()

        if normalized_quiz_id:
            items = [item for item in items if item.get("quizId") == normalized_quiz_id]
        return sorted(items, key=lambda item: str(item.get("createdAt", "")), reverse=True)

    def save_quiz_result(self, quiz_id: str, result: dict) -> dict:
        # Tallentaa yhden quiz-tuloksen kayttajan tiedostoihin
        normalized_quiz_id = str(quiz_id or "").strip()
        if not normalized_quiz_id:
            raise ValueError("quiz_id is required")
        if not isinstance(result, dict):
            raise ValueError("result must be an object")

        created_at = utc_now_iso()
        entry = {
            "id": laske_sha256(
                json.dumps(
                    {"quizId": normalized_quiz_id, "result": result, "createdAt": created_at},
                    sort_keys=True,
                    ensure_ascii=False,
                )
            )[:16],
            "quizId": normalized_quiz_id,
            "createdAt": created_at,
            "result": result,
        }

        with self._lock:
            items = self._load_quiz_results()
            items.append(entry)
            self._write_quiz_results(items)
        return entry

    def remove_quiz_result(self, result_id: str) -> bool:

        # Poistaa yhden quiz-tuloksen tunnisteen perusteella
        normalized_result_id = str(result_id or "").strip()
        if not normalized_result_id:
            raise ValueError("result_id is required")

        with self._lock:
            items = self._load_quiz_results()
            filtered_items = [
                item for item in items if str(item.get("id", "")).strip() != normalized_result_id
            ]
            if len(filtered_items) == len(items):
                return False
            self._write_quiz_results(filtered_items)
        return True

    def get_quiz_session(self, quiz_id: str) -> dict | None:

        # Palauttaa quizin keskeneraisen istunnon, jos sellainen on olemassa
        normalized_quiz_id = str(quiz_id or "").strip()
        if not normalized_quiz_id:
            raise ValueError("quiz_id is required")

        with self._lock:
            items = self._load_quiz_sessions()

        for item in items:
            if str(item.get("quizId", "")).strip() == normalized_quiz_id:
                return item
        return None

    def save_quiz_session(self, quiz_id: str, session: dict) -> dict:
        # Tallentaa quizin keskeneraisen istunnon jatkamista varten

        normalized_quiz_id = str(quiz_id or "").strip()
        if not normalized_quiz_id:
            raise ValueError("quiz_id is required")
        if not isinstance(session, dict):
            raise ValueError("session must be an object")

        updated_at = utc_now_iso()
        entry = {"quizId": normalized_quiz_id, "updatedAt": updated_at, "session": session}

        with self._lock:
            items = self._load_quiz_sessions()
            filtered_items = [
                item for item in items if str(item.get("quizId", "")).strip() != normalized_quiz_id
            ]
            filtered_items.append(entry)
            self._write_quiz_sessions(filtered_items)
        return entry

    def clear_quiz_session(self, quiz_id: str) -> bool:

        # Poistaa quizin keskeneraisen istunnon
        normalized_quiz_id = str(quiz_id or "").strip()
        if not normalized_quiz_id:
            raise ValueError("quiz_id is required")

        with self._lock:
            items = self._load_quiz_sessions()
            filtered_items = [
                item for item in items if str(item.get("quizId", "")).strip() != normalized_quiz_id
            ]
            if len(filtered_items) == len(items):
                return False
            self._write_quiz_sessions(filtered_items)
        return True

    def list_opiskelu_suunnat(self) -> list[dict[str, str | int]]:

        # Lukee opintopolkujen sisallon suoraan JSON-tiedostosta
        source_path = self._paths.opiskelu_suunnat_json_path()
        if not source_path.exists():
            raise FileNotFoundError(f"Missing source data: {source_path}")

        raw_text = source_path.read_text(encoding="utf-8")
        data = parse_json_payload(raw_text, "opiskeluSuunnat.json")

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
                    "img": self._paths.normalize_ui_asset_ref(str(item.get("img", "")).strip()),
                    "nimi": nimi,
                    "desc": str(item.get("desc", "")).strip(),
                    "kenelle": str(item.get("kenelle", "")).strip(),
                }
            )
        return items

    def get_opintopolku_quiz(self) -> dict:

        # Palauttaa opintopolku-kyselyn datan JSON-tiedostosta
        source_path = self._paths.opintopolku_quiz_json_path()
        if not source_path.exists():
            raise FileNotFoundError(f"Missing source data: {source_path}")

        raw_text = source_path.read_text(encoding="utf-8")
        data = parse_json_payload(raw_text, "opintopolkuQuiz.json")
        if not isinstance(data, dict):
            raise ValueError("opintopolkuQuiz.json root payload must be an object")
        return data
