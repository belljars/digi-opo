# Projektin polkujen ja staattisten resurssien hallinta

# Tämä moduuli kokoaa yhteen tiedostopolut, joita backend ja käyttöliittymä tarvitsevat, sekä käynnistää kevyen paikallisen palvelimen UI-resursseille

from __future__ import annotations  # Siirtää tyyppivihjeiden tulkinnan myöhemmäksi

from dataclasses import dataclass  # Luo kevyen luokan, joka säilyttää projektin polut selkeästi

from functools import partial  # Esitäyttää HTTP-käsittelijälle projektijuuren palvelinhakemistoksi

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer  # Tarjoaa kevyen paikallisen HTTP-palvelimen UI-tiedostoille

from pathlib import Path  # Käsittelee projektin tiedostopolkuja käyttöjärjestelmäriippumattomasti

import threading  # Käynnistää staattisen palvelimen taustasäikeessä

from urllib.parse import urlparse  # Purkaa URL-polusta varsinaisen reitin turvallisuustarkistusta varten


def is_allowed_static_path(request_path: str) -> bool:
    # Tarkistaa, että HTTP-palvelin tarjoilee vain käyttöliittymän tiedostoja
    return urlparse(request_path).path.startswith("/src/ui/")


@dataclass(frozen=True)
class ProjectPaths:
    # Kokoaa sovelluksen tarvitsemat tiedostopolut yhden olion alle

    project_root: Path

    def ui_index_path(self) -> str:
        # Palauttaa käyttöliittymän aloitussivun HTTP-polun
        return "/src/ui/pages/home.html"

    def tietokanta_path(self) -> Path:
        # Varmistaa datakansion ja palauttaa SQLite-tietokannan polun
        data_dir = self.project_root / "data"
        data_dir.mkdir(exist_ok=True)
        return data_dir / "tutkinnot.db"

    def kayttaja_data_dir(self) -> Path:
        # Palauttaa käyttäjäkohtaisen tallennuskansion ja luo sen tarvittaessa
        user_dir = self.project_root / "user"
        user_dir.mkdir(exist_ok=True)
        return user_dir

    def lahde_json_path(self) -> Path:
        # Palauttaa tutkintodatan päälähteen polun
        return self.project_root / "src" / "data" / "ammatit.json"

    def opiskelu_suunnat_json_path(self) -> Path:
        # Palauttaa opiskelu- ja opintopolkujen esittelydatan polun
        return self.project_root / "src" / "data" / "opiskeluSuunnat.json"

    def opintopolku_quiz_json_path(self) -> Path:
        # Palauttaa opintopolkuvisan datatiedoston polun
        return self.project_root / "src" / "data" / "opintopolkuQuiz.json"

    def saved_tutkintonimikkeet_path(self) -> Path:
        # Palauttaa vanhan suosikkien JSON-tallennuksen polun migraatiota varten
        return self.kayttaja_data_dir() / "saved_tutkintonimikkeet.json"

    def quiz_vastaus_polku(self) -> Path:
        # Palauttaa visatulosten tallennuspolun
        return self.kayttaja_data_dir() / "quiz_results.json"

    def quiz_tila_polku(self) -> Path:
        # Palauttaa keskeneräisten visojen tallennuspolun
        return self.kayttaja_data_dir() / "quiz_sessions.json"

    def resolve_local_ui_path(self, raw_path: str) -> Path | None:
        # Ratkoo käyttöliittymäresurssin paikallisen polun turvallisesti projektin sisältä
        candidate_text = str(raw_path or "").strip()
        if not candidate_text:
            return None

        if urlparse(candidate_text).scheme:
            return None

        # Siistitään polku selaimesta tai JSONista tulevasta muodosta yhtenäiseksi
        normalized = candidate_text.replace("\\", "/")
        while normalized.startswith("./"):
            normalized = normalized[2:]
        while normalized.startswith("../"):
            normalized = normalized[3:]
        normalized = normalized.lstrip("/")

        if not normalized:
            return None

        # Kokeillaan useita järkeviä suhteellisia vaihtoehtoja, jotta data voi viitata tiedostoihin eri tavoilla ilman, että UI-koodi rikkoutuu
        rel_candidates = [Path(normalized)]
        if normalized.startswith("src/ui/"):
            rel_candidates.append(Path(normalized.removeprefix("src/ui/")))
        elif normalized.startswith("ui/"):
            rel_candidates.append(Path(normalized.removeprefix("ui/")))

        for rel in list(rel_candidates):
            rel_candidates.append(Path("src/ui") / rel)

        seen: set[Path] = set()
        for rel in rel_candidates:
            if rel in seen:
                continue
            seen.add(rel)
            abs_path = self.project_root / rel
            if abs_path.exists():
                return abs_path
        return None

    def normalize_ui_asset_ref(self, raw_path: str) -> str:
        # Muuntaa paikallisen resurssiviittauksen HTTP-poluksi käyttöliittymää varten
        resolved = self.resolve_local_ui_path(raw_path)
        if not resolved:
            return raw_path

        try:
            rel = resolved.relative_to(self.project_root).as_posix()
            return f"/{rel}"
        except ValueError:
            return raw_path


def start_static_server(paths: ProjectPaths) -> tuple[ThreadingHTTPServer, int]:
    # Käynnistää kevyen paikallisen HTTP-palvelimen pywebview-käyttöä varten

    class UiOnlyRequestHandler(SimpleHTTPRequestHandler):
        # Palvelin sallii vain käyttöliittymän tiedostot

        def send_head(self):
            if not is_allowed_static_path(self.path):
                self.send_error(404, "File not found")
                return None
            return super().send_head()

    handler = partial(UiOnlyRequestHandler, directory=str(paths.project_root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, server.server_port
