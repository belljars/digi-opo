'''Sisältää backend-API:n toteutuksen, joka yhdistää useista osa-alueista peräisin olevat metodit yhdeksi luokaksi'''
from __future__ import annotations
from typing import Any
from apu import utc_now_iso

class AsetuksetApiMixin:
    '''Mixin, joka lisää backendiin asetuksiin liittyvät metodit'''

    _lock: Any
    _conn: Any

    def list_hidden_tutkinnot(self) -> list[dict[str, str | int]]:
        '''Listaa tutkinnot, jotka käyttäjä on piilottanut näkyvistä'''

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
        '''Listaa yksittäiset tutkintonimikkeet, jotka on piilotettu näkyvistä'''

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

    def list_paikkakunnat(self) -> list[dict[str, str | int]]:
        '''Listaa näkyvät paikkakunnat asetusten hallintaa varten'''

        with self._lock:
            rows = self._conn.execute(
                """
                SELECT n.paikkakunta
                FROM tutkintonimikkeet n
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                WHERE ht.tutkinto_id IS NULL AND hn.tutkintonimike_id IS NULL;
                """
            ).fetchall()
            hidden_rows = self._conn.execute("SELECT paikkakunta FROM hidden_paikkakunnat;").fetchall()

        hidden = {str(row["paikkakunta"]).strip().casefold() for row in hidden_rows if str(row["paikkakunta"]).strip()}
        labels: dict[str, str] = {}
        counts: dict[str, int] = {}
        for row in rows:
            for paikkakunta in self._parse_paikkakunnat(row["paikkakunta"]):
                key = paikkakunta.casefold()
                if key in hidden:
                    continue
                labels.setdefault(key, paikkakunta)
                counts[key] = counts.get(key, 0) + 1

        return [
            {"paikkakunta": labels[key], "tutkintonimikeCount": counts[key]}
            for key in sorted(labels, key=lambda value: labels[value])
        ]

    def list_hidden_paikkakunnat(self) -> list[dict[str, str | int]]:
        '''Listaa paikkakunnat, jotka käyttäjä on piilottanut näkyvistä'''

        with self._lock:
            rows = self._conn.execute(
                """
                SELECT
                    hp.paikkakunta,
                    hp.hidden_at,
                    SUM(
                        CASE
                            WHEN n.id IS NOT NULL
                              AND ht.tutkinto_id IS NULL
                              AND hn.tutkintonimike_id IS NULL
                            THEN 1
                            ELSE 0
                        END
                    ) AS tutkintonimike_count
                FROM hidden_paikkakunnat hp
                LEFT JOIN tutkintonimikkeet n
                  ON EXISTS (
                    SELECT 1
                    FROM json_each(n.paikkakunta)
                    WHERE lower(json_each.value) = lower(hp.paikkakunta)
                  )
                LEFT JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
                GROUP BY hp.paikkakunta, hp.hidden_at
                ORDER BY hp.paikkakunta;
                """
            ).fetchall()
        return [
            {
                "paikkakunta": row["paikkakunta"],
                "hiddenAt": row["hidden_at"],
                "tutkintonimikeCount": row["tutkintonimike_count"],
            }
            for row in rows
        ]

    def hide_tutkinto(self, tutkinto_id: int) -> bool:
        '''Merkitsee tutkinnon piilotetuksi koko sovelluksessa'''

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
        '''Poistaa tutkinnon piilotuksen ja palauttaa sen jälleen näkyviin'''

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
        '''Merkitsee yksittäisen tutkintonimikkeen piilotetuksi'''

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
        '''Poistaa tutkintonimikkeen piilotuksen'''

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

    def hide_paikkakunta(self, paikkakunta: str) -> bool:
        '''Merkitsee paikkakunnan piilotetuksi koko sovelluksessa'''

        normalized = str(paikkakunta or "").strip()
        if not normalized:
            raise ValueError("Paikkakunta is required")

        with self._lock:
            exists = self._conn.execute(
                """
                SELECT 1
                FROM tutkintonimikkeet n, json_each(n.paikkakunta)
                WHERE lower(json_each.value) = lower(?)
                LIMIT 1;
                """,
                (normalized,),
            ).fetchone()
            if not exists:
                raise ValueError(f"Unknown paikkakunta: {normalized}")
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO hidden_paikkakunnat (paikkakunta, hidden_at)
                    VALUES (?, ?)
                    ON CONFLICT(paikkakunta) DO UPDATE SET hidden_at = excluded.hidden_at;
                    """,
                    (normalized, utc_now_iso()),
                )
        return True

    def unhide_paikkakunta(self, paikkakunta: str) -> bool:
        '''Poistaa paikkakunnan piilotuksen'''

        normalized = str(paikkakunta or "").strip()
        if not normalized:
            raise ValueError("Paikkakunta is required")

        with self._lock:
            with self._conn:
                cursor = self._conn.execute(
                    """
                    DELETE FROM hidden_paikkakunnat
                    WHERE lower(paikkakunta) = lower(?);
                    """,
                    (normalized,),
                )
        return cursor.rowcount > 0
