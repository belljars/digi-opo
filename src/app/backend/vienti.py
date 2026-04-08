from __future__ import annotations

from backend_apu import utc_now_iso

from .pdf_vienti import build_user_export_html, render_html_to_pdf


class VientiApiMixin:
    # Mixin, joka kokoaa käyttäjän tallennetut tiedot yhteen PDF-vientiä varten

    def _list_all_saved_tutkintonimikkeet_for_export(self) -> list[dict]:
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
                    s.plan_updated_at,
                    CASE WHEN ht.tutkinto_id IS NOT NULL OR hn.tutkintonimike_id IS NOT NULL THEN 1 ELSE 0 END AS is_hidden
                FROM saved_tutkintonimikkeet s
                JOIN tutkintonimikkeet n ON n.id = s.tutkintonimike_id
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
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
                "isHidden": bool(row["is_hidden"]),
            }
            for row in rows
        ]

    def _list_all_notes_for_export(self) -> list[dict]:
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
                    notes.note_text,
                    notes.updated_at,
                    CASE WHEN ht.tutkinto_id IS NOT NULL OR hn.tutkintonimike_id IS NOT NULL THEN 1 ELSE 0 END AS is_hidden
                FROM tutkintonimike_notes notes
                JOIN tutkintonimikkeet n ON n.id = notes.tutkintonimike_id
                JOIN tutkinnot t ON t.id = n.tutkinto_id
                LEFT JOIN hidden_tutkinnot ht ON ht.tutkinto_id = t.id
                LEFT JOIN hidden_tutkintonimikkeet hn ON hn.tutkintonimike_id = n.id
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
                "isHidden": bool(row["is_hidden"]),
            }
            for row in rows
        ]

    def _build_user_export_payload(self, output_path) -> dict:
        saved_items = self._list_all_saved_tutkintonimikkeet_for_export()
        notes = self._list_all_notes_for_export()
        hidden_tutkinnot = self.list_hidden_tutkinnot()
        hidden_tutkintonimikkeet = self.list_hidden_tutkintonimikkeet()
        quiz_results = self.list_quiz_results()
        with self._lock:
            quiz_sessions = sorted(
                self._load_quiz_sessions(),
                key=lambda item: str(item.get("updatedAt", "")),
                reverse=True,
            )

        return {
            "exportedAt": utc_now_iso(),
            "fileName": output_path.name,
            "summary": {
                "savedCount": len(saved_items),
                "noteCount": len(notes),
                "hiddenTutkinnotCount": len(hidden_tutkinnot),
                "hiddenTutkintonimikkeetCount": len(hidden_tutkintonimikkeet),
                "quizResultCount": len(quiz_results),
                "quizSessionCount": len(quiz_sessions),
            },
            "sections": {
                "savedTutkintonimikkeet": saved_items,
                "notes": notes,
                "hiddenTutkinnot": hidden_tutkinnot,
                "hiddenTutkintonimikkeet": hidden_tutkintonimikkeet,
                "quizResults": quiz_results,
                "quizSessions": quiz_sessions,
            },
        }

    def export_user_data_pdf(self) -> dict[str, str | int]:
        # Luo käyttäjän tallennetuista tiedoista luettavan PDF-raportin exports-kansioon
        output_path = self._paths.user_export_pdf_path()
        payload = self._build_user_export_payload(output_path)
        html = build_user_export_html(payload)
        render_html_to_pdf(html, output_path)
        summary = payload["summary"]
        return {
            "success": True,
            "path": str(output_path),
            "fileName": output_path.name,
            "savedCount": summary["savedCount"],
            "noteCount": summary["noteCount"],
            "hiddenTutkinnotCount": summary["hiddenTutkinnotCount"],
            "hiddenTutkintonimikkeetCount": summary["hiddenTutkintonimikkeetCount"],
            "quizResultCount": summary["quizResultCount"],
            "quizSessionCount": summary["quizSessionCount"],
        }
