from __future__ import annotations

import json

from backend_apu import utc_now_iso


DEFAULT_ACCESSIBILITY_SETTINGS = {
    "contrast": "default",
    "fontFamily": "system",
    "fontSize": "100",
    "lineHeight": "normal",
    "reducedMotion": False,
    "strongFocus": False,
    "largerTargets": False,
}


def _normalize_accessibility_settings(raw: object) -> dict[str, str | bool]:
    allowed_contrast = {"default", "light-high", "dark-high"}
    allowed_font_family = {"system", "sans", "serif", "dyslexia"}
    allowed_font_size = {"100", "112", "125", "150"}
    allowed_line_height = {"normal", "comfortable", "loose"}
    settings = dict(DEFAULT_ACCESSIBILITY_SETTINGS)

    if not isinstance(raw, dict):
        return settings

    contrast = raw.get("contrast")
    if contrast in allowed_contrast:
        settings["contrast"] = contrast

    font_family = raw.get("fontFamily")
    if font_family in allowed_font_family:
        settings["fontFamily"] = font_family

    font_size = raw.get("fontSize")
    if font_size in allowed_font_size:
        settings["fontSize"] = font_size

    line_height = raw.get("lineHeight")
    if line_height in allowed_line_height:
        settings["lineHeight"] = line_height

    for key in ("reducedMotion", "strongFocus", "largerTargets"):
        value = raw.get(key)
        if isinstance(value, bool):
            settings[key] = value

    return settings


class AsetuksetApiMixin:
    def get_accessibility_settings(self) -> dict[str, str | bool]:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT value
                FROM app_settings
                WHERE key = 'accessibility';
                """
            ).fetchone()

        if not row:
            return dict(DEFAULT_ACCESSIBILITY_SETTINGS)

        try:
            payload = json.loads(row["value"])
        except json.JSONDecodeError:
            return dict(DEFAULT_ACCESSIBILITY_SETTINGS)

        return _normalize_accessibility_settings(payload)

    def save_accessibility_settings(self, settings: object) -> dict[str, str | bool]:
        normalized = _normalize_accessibility_settings(settings)

        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO app_settings (key, value, updated_at)
                    VALUES ('accessibility', ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = excluded.updated_at;
                    """,
                    (json.dumps(normalized), utc_now_iso()),
                )

        return normalized

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
