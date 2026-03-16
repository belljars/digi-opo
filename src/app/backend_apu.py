from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_json_payload(raw_text: str, source_name: str) -> dict:
    # Lukee JSON-tekstin ja sallii myos mahdollisen ylimaaraisen hannan lopussa
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        data, _ = decoder.raw_decode(raw_text.lstrip())

    if not isinstance(data, dict):
        raise ValueError(f"{source_name} root payload must be an object")
    return data


def laske_sha256(text: str) -> str:
    # Laskee merkkijonolle vakaan SHA-256-tiivisteen
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def utc_now_iso() -> str:
    # Palauttaa nykyhetken UTC-ajassa ISO-muodossa
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def lue_json_objekti(path: Path, default: dict) -> dict:
    # Lukee tiedostosta JSON-olion tai palauttaa oletusarvon
    if not path.exists():
        return dict(default)

    raw_text = path.read_text(encoding="utf-8").strip()
    if not raw_text:
        return dict(default)

    data = parse_json_payload(raw_text, path.name)
    return data if isinstance(data, dict) else dict(default)


def kirjoita_json_objekti(path: Path, payload: dict) -> None:
    # Kirjoittaa JSONin ensin valiaikaiseen tiedostoon ja vaihtaa sen paikoilleen
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp_path.replace(path)
