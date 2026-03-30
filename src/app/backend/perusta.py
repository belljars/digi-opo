# Backendin perusrakenne ja yhteiset tallennusapumetodit

# Perusluokka avaa tietokantayhteyden, varmistaa lähdedatan saatavuuden ja tarjoaa yhteiset metodit visatietojen tallentamiseen tiedostoihin

from __future__ import annotations  # Siirtää tyyppivihjeiden tulkinnan myöhemmäksi

import sqlite3  # Työskentelee sovelluksen SQLite-tietokannan kanssa

import threading  # Suojaa backendin yhteisiä resursseja rinnakkaiselta käytöltä

from backend_apu import (  # Tuo tiedosto- ja aikaleima-apurit backendin yhteisiin tallennuksiin
    kirjoita_json_objekti,  # Kirjoittaa JSON-tiedoston turvallisesti levylle
    lue_json_objekti,  # Lukee JSON-objektin tiedostosta oletusarvon kanssa
    utc_now_iso,  # Luo tallennuksille yhtenäisen UTC-aikaleiman
)
from projekti_paths import ProjectPaths  # Tarjoaa backendille kaikki tarvittavat projektin tiedostopolut

from .tietokanta import (  # Tuo tietokannan avauksen, datan varmistuksen ja vanhan datan migraation
    connect_db,  # Avaa SQLite-yhteyden sovelluksen tietokantaan
    ensure_data,  # Varmistaa, että skeema ja lähdedata ovat ajan tasalla
    migrate_saved_tutkintonimikkeet_from_json,  # Siirtää vanhat JSON-suosikit SQLiteen
)


class BackendBase:
    # Backendin kantaluokka, jonka päälle muut mixinit rakentuvat

    _paths: ProjectPaths
    _conn: sqlite3.Connection
    _lock: threading.Lock
    _closed: bool

    def __init__(self, paths: ProjectPaths) -> None:
        # Avaa tietokannan ja varmistaa, että sovelluksen data on käyttövalmista
        self._paths = paths
        self._conn = connect_db(paths)
        self._lock = threading.Lock()
        self._closed = False
        ensure_data(self._conn, self._paths)
        migrate_saved_tutkintonimikkeet_from_json(self._conn, self._paths)

    def close(self) -> None:
        # Sulkee tietokantayhteyden hallitusti sovelluksen tai testin lopussa
        with self._lock:
            if self._closed:
                return
            self._conn.close()
            self._closed = True

    def _load_quiz_results(self) -> list[dict]:
        # Lukee tallennetut visatulokset käyttäjän JSON-tiedostosta
        data = lue_json_objekti(self._paths.quiz_vastaus_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_results(self, items: list[dict]) -> None:
        # Kirjoittaa visatulokset levylle aikaleiman kanssa
        kirjoita_json_objekti(
            self._paths.quiz_vastaus_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )

    def _load_quiz_sessions(self) -> list[dict]:
        # Lukee keskeneräiset visaistunnot käyttäjän JSON-tiedostosta
        data = lue_json_objekti(self._paths.quiz_tila_polku(), {"items": []})
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    def _write_quiz_sessions(self, items: list[dict]) -> None:
        # Kirjoittaa keskeneräiset visaistunnot levylle aikaleiman kanssa
        kirjoita_json_objekti(
            self._paths.quiz_tila_polku(),
            {"items": items, "updatedAt": utc_now_iso()},
        )
