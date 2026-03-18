from __future__ import annotations

from backend_apu import utc_now_iso


class TutkinnotApiMixin:
    _ALLOWED_PLAN_PRIORITIES = {"", "ensisijainen", "selvitettava", "varavaihtoehto"}
    _ALLOWED_PLAN_STATUSES = {"", "en-tieda-viela", "haluan-selvittaa-lisaa", "vahva-vaihtoehto"}

    def _get_visible_tutkintonimike_row(self, nimike_id: int):
        return self._conn.execute(
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

    def _serialize_saved_item(self, row, saved_at: str, plan_priority, plan_status, next_step, plan_updated_at) -> dict:
        return {
            "id": row["id"],
            "nimi": row["nimi"],
            "linkki": row["linkki"],
            "img": row["img"],
            "tutkinto_id": row["tutkinto_id"],
            "tutkinto_nimi": row["tutkinto_nimi"],
            "savedAt": saved_at,
            "planPriority": plan_priority or None,
            "planStatus": plan_status or None,
            "nextStep": next_step or None,
            "planUpdatedAt": plan_updated_at or None,
        }

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
                SELECT
                    n.id,
                    n.nimi,
                    n.linkki,
                    n.img,
                    n.tutkinto_id,
                    t.nimi AS tutkinto_nimi,
                    s.saved_at,
                    s.plan_priority,
                    s.plan_status,
                    s.next_step,
                    s.plan_updated_at
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
                "planPriority": row["plan_priority"],
                "planStatus": row["plan_status"],
                "nextStep": row["next_step"],
                "planUpdatedAt": row["plan_updated_at"],
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
            row = self._get_visible_tutkintonimike_row(nimike_id)
            if row is None:
                raise ValueError(f"Unknown tutkintonimike id: {nimike_id}")
            existing = self._conn.execute(
                """
                SELECT saved_at, plan_priority, plan_status, next_step, plan_updated_at
                FROM saved_tutkintonimikkeet
                WHERE tutkintonimike_id = ?;
                """,
                (nimike_id,),
            ).fetchone()
            saved_at = existing["saved_at"] if existing else utc_now_iso()
            plan_priority = existing["plan_priority"] if existing else None
            plan_status = existing["plan_status"] if existing else None
            next_step = existing["next_step"] if existing else None
            plan_updated_at = existing["plan_updated_at"] if existing else None
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO saved_tutkintonimikkeet (tutkintonimike_id, saved_at)
                    VALUES (?, ?)
                    ON CONFLICT(tutkintonimike_id) DO NOTHING;
                    """,
                    (nimike_id, saved_at),
                )
        return self._serialize_saved_item(
            row,
            saved_at,
            plan_priority,
            plan_status,
            next_step,
            plan_updated_at,
        )

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

    def save_tutkintonimike_plan(
        self,
        tutkintonimike_id: int,
        priority: str | None,
        status: str | None,
        next_step: str | None,
    ) -> dict:
        try:
            nimike_id = int(tutkintonimike_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid tutkintonimike id") from exc

        normalized_priority = str(priority or "").strip()
        normalized_status = str(status or "").strip()
        normalized_next_step = str(next_step or "").strip()

        if normalized_priority not in self._ALLOWED_PLAN_PRIORITIES:
            raise ValueError("Invalid plan priority")
        if normalized_status not in self._ALLOWED_PLAN_STATUSES:
            raise ValueError("Invalid plan status")

        plan_updated_at = utc_now_iso() if (normalized_priority or normalized_status or normalized_next_step) else None

        with self._lock:
            row = self._get_visible_tutkintonimike_row(nimike_id)
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

            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO saved_tutkintonimikkeet (
                        tutkintonimike_id,
                        saved_at,
                        plan_priority,
                        plan_status,
                        next_step,
                        plan_updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(tutkintonimike_id) DO UPDATE
                    SET
                        plan_priority = excluded.plan_priority,
                        plan_status = excluded.plan_status,
                        next_step = excluded.next_step,
                        plan_updated_at = excluded.plan_updated_at;
                    """,
                    (
                        nimike_id,
                        saved_at,
                        normalized_priority or None,
                        normalized_status or None,
                        normalized_next_step or None,
                        plan_updated_at,
                    ),
                )

        return self._serialize_saved_item(
            row,
            saved_at,
            normalized_priority,
            normalized_status,
            normalized_next_step,
            plan_updated_at,
        )

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
