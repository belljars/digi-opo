from __future__ import annotations

from backend_apu import parse_json_payload


class SisaltoApiMixin:
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
