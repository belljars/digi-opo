from __future__ import annotations

from dataclasses import dataclass
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from urllib.parse import urlparse


@dataclass(frozen=True)
class ProjectPaths:
    # Kokoaa projektin polut yhteen paikkaan
    project_root: Path

    def ui_index_path(self) -> str:
        # Palauttaa sovelluksen ensimmaisen HTML-sivun
        return "/src/ui/pages/home.html"

    def tietokanta_path(self) -> Path:
        # Varmistaa data-kansion ja palauttaa SQLite-polun
        data_dir = self.project_root / "data"
        data_dir.mkdir(exist_ok=True)
        return data_dir / "tutkinnot.db"

    def kayttaja_data_dir(self) -> Path:
        # Varmistaa kayttajakohtaisen tallennuskansion
        user_dir = self.project_root / "user"
        user_dir.mkdir(exist_ok=True)
        return user_dir

    def lahde_json_path(self) -> Path:
        # Palauttaa tutkintojen lahde-JSONin polun
        return self.project_root / "src" / "data" / "ammatit.json"

    def opiskelu_suunnat_json_path(self) -> Path:
        # Palauttaa opintopolkujen datatiedoston polun
        return self.project_root / "src" / "data" / "opiskeluSuunnat.json"

    def opintopolku_quiz_json_path(self) -> Path:
        # Palauttaa opintopolku-kyselyn datatiedoston polun
        return self.project_root / "src" / "data" / "opintopolkuQuiz.json"

    def saved_tutkintonimikkeet_path(self) -> Path:
        # Palauttaa vanhan suosikkien JSON-tallennuksen polun
        return self.kayttaja_data_dir() / "saved_tutkintonimikkeet.json"

    def quiz_vastaus_polku(self) -> Path:
        # Palauttaa quiz-tulosten tallennuspolun
        return self.kayttaja_data_dir() / "quiz_results.json"

    def quiz_tila_polku(self) -> Path:
        # Palauttaa quiz-istunnon tallennuspolun
        return self.kayttaja_data_dir() / "quiz_sessions.json"

    def resolve_local_ui_path(self, raw_path: str) -> Path | None:
        # Ratkoo UI:n paikallisen resurssipolun turvallisesti projektin sisalta
        candidate_text = str(raw_path or "").strip()
        if not candidate_text:
            return None

        if urlparse(candidate_text).scheme:
            return None

        normalized = candidate_text.replace("\\", "/")
        while normalized.startswith("./"):
            normalized = normalized[2:]
        while normalized.startswith("../"):
            normalized = normalized[3:]
        normalized = normalized.lstrip("/")

        if not normalized:
            return None

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
        # Muuntaa loydetyn resurssin HTTP-yhteensopivaksi poluksi
        resolved = self.resolve_local_ui_path(raw_path)
        if not resolved:
            return raw_path

        try:
            rel = resolved.relative_to(self.project_root).as_posix()
            return f"/{rel}"
        except ValueError:
            return raw_path


def start_static_server(paths: ProjectPaths) -> tuple[ThreadingHTTPServer, int]:
    # Kaynnistaa kevyen paikallisen tiedostopalvelimen pywebviewta varten
    
    handler = partial(SimpleHTTPRequestHandler, directory=str(paths.project_root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, server.server_port
