# Yhteisiä apufunktioita backendin tiedostojen käsittelyyn.

# Moduuli tarjoaa pieniä, uudelleenkäytettäviä utiliteetteja esimerkiksi JSON-datan lukemiseen, tiedostokirjoituksiin ja aikaleimoihin

from __future__ import annotations  # Siirtää tyyppivihjeiden tulkinnan myöhemmäksi

import hashlib  # Laskee tiivisteitä datan muutosten tunnistamiseen
import json  # Lukee ja kirjoittaa JSON-rakenteita tiedostoista
from datetime import datetime, timezone  # Muodostaa UTC-aikaleimat tallennuksia varten
from pathlib import Path  # Käsittelee tiedostopolkuja turvallisesti


def parse_json_payload(raw_text: str, source_name: str) -> dict:
    # Lukee JSON-olion ja sietää lähdedatan mahdollisen ylimääräisen hännän
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        # Osa lähdetiedostoista voi sisältää varsinaisen JSON-olion jälkeen ylimääräistä tekstiä, joten poimitaan vähintään ensimmäinen objekti
        decoder = json.JSONDecoder()
        data, _ = decoder.raw_decode(raw_text.lstrip())

    if not isinstance(data, dict):
        raise ValueError(f"{source_name} root payload must be an object")
    return data


def laske_sha256(text: str) -> str:
    # Laskee annetulle merkkijonolle vakaan SHA-256-tiivisteen
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def utc_now_iso() -> str:
    # Palauttaa nykyhetken UTC-aikana ISO 8601 -merkkijonona
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def lue_json_objekti(path: Path, default: dict) -> dict:
    # Lukee tiedostosta JSON-olion tai palauttaa oletuksen, jos tiedosto puuttuu
    if not path.exists():
        return dict(default)

    raw_text = path.read_text(encoding="utf-8").strip()
    if not raw_text:
        return dict(default)

    data = parse_json_payload(raw_text, path.name)
    return data if isinstance(data, dict) else dict(default)


def kirjoita_json_objekti(path: Path, payload: dict) -> None:
    # Kirjoittaa JSONin turvallisesti väliaikaistiedoston kautta lopulliseen polkuun
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp_path.replace(path)
