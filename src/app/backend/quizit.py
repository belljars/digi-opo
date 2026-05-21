'''Visojen tuloksiin ja istuntoihin liittyvä backend-rajapinta'''

from __future__ import annotations
import json
from threading import Lock

from backend_apu import (
    laske_sha256,
    utc_now_iso,
)


class QuizitApiMixin:
    '''Mixin, joka lisää backendiin visatulosten ja -istuntojen hallinnan'''

    _lock: Lock

    def _load_quiz_results(self) -> list[dict]:
        raise NotImplementedError

    def _write_quiz_results(self, items: list[dict]) -> None:
        raise NotImplementedError

    def _load_quiz_sessions(self) -> list[dict]:
        raise NotImplementedError

    def _write_quiz_sessions(self, items: list[dict]) -> None:
        raise NotImplementedError

    def list_quiz_results(self, quiz_id: str | None = None) -> list[dict]:
        '''Palauttaa tallennetut visatulokset, haluttaessa yhden visan perusteella suodatettuna'''

        normalized_quiz_id = str(quiz_id or "").strip()
        with self._lock:
            items = self._load_quiz_results()

        if normalized_quiz_id:
            items = [item for item in items if item.get("quizId") == normalized_quiz_id]
        return sorted(items, key=lambda item: str(item.get("createdAt", "")), reverse=True)

    def save_quiz_result(self, quiz_id: str, result: dict) -> dict:
        '''Tallentaa yhden visatuloksen käyttäjän omaan tiedostoon'''

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
        '''Poistaa yksittäisen visatuloksen sen tunnisteen perusteella'''

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
        '''Palauttaa visan keskeneräisen istunnon, jos sellainen on tallennettu'''

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
        '''Tallentaa keskeneräisen visaistunnon, jotta sitä voi jatkaa myöhemmin'''

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
        '''Poistaa tallennetun keskeneräisen visaistunnon'''

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
