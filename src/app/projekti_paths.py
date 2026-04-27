# Projektin polkujen ja staattisten resurssien hallinta

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import posixpath
import sys
import threading
from urllib.parse import unquote, urlparse


def is_allowed_static_path(request_path: str) -> bool:
    # Staattinen palvelin tarjoilee vain kayttoliittyman tiedostoja.
    raw_path = unquote(urlparse(request_path).path)
    normalized_path = posixpath.normpath(raw_path)
    if raw_path.endswith("/") and not normalized_path.endswith("/"):
        normalized_path = f"{normalized_path}/"
    return normalized_path == "/src/ui" or normalized_path.startswith("/src/ui/")


def default_user_data_root() -> Path:
    # Kirjoitettava sovellusdata pidetaan erillaan pakatuista resursseista.
    if sys.platform.startswith("win"):
        base = os.environ.get("LOCALAPPDATA")
        if base:
            return Path(base) / "digi-opo"
        return Path.home() / "AppData" / "Local" / "digi-opo"

    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "digi-opo"

    base = os.environ.get("XDG_DATA_HOME")
    if base:
        return Path(base) / "digi-opo"
    return Path.home() / ".local" / "share" / "digi-opo"


@dataclass(frozen=True)
class ProjectPaths:
    # resource_root sisältää sovelluksen mukana tulevat tiedostot.
    # user_data_root sisältää ajossa syntyvät kirjoitettavat tiedostot.

    resource_root: Path
    user_data_root: Path | None = None

    def __post_init__(self) -> None:
        resource_root = Path(self.resource_root)
        user_data_root = Path(self.user_data_root) if self.user_data_root else resource_root
        object.__setattr__(self, "resource_root", resource_root)
        object.__setattr__(self, "user_data_root", user_data_root)

    @property
    def project_root(self) -> Path:
        # Vanha nimi pidetaan lukuyhteensopivana nykyiselle koodille.
        return self.resource_root

    @classmethod
    def for_runtime(cls, resource_root: Path) -> "ProjectPaths":
        return cls(resource_root=resource_root, user_data_root=default_user_data_root())

    def ui_index_path(self) -> str:
        return "/src/ui/pages/home.html"

    def tietokanta_path(self) -> Path:
        data_dir = self.user_data_root / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir / "tutkinnot.db"

    def kayttaja_data_dir(self) -> Path:
        user_dir = self.user_data_root / "user"
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def vienti_dir(self) -> Path:
        export_dir = self.user_data_root / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        return export_dir

    def user_export_pdf_path(self) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        return self.vienti_dir() / f"digi-opo-kayttajatiedot-{timestamp}.pdf"

    def lahde_json_path(self) -> Path:
        return self.resource_root / "src" / "data" / "ammatit.json"

    def opiskelu_suunnat_json_path(self) -> Path:
        return self.resource_root / "src" / "data" / "opiskeluSuunnat.json"

    def opintopolku_quiz_json_path(self) -> Path:
        return self.resource_root / "src" / "data" / "opintopolkuQuiz.json"

    def saved_tutkintonimikkeet_path(self) -> Path:
        return self.kayttaja_data_dir() / "saved_tutkintonimikkeet.json"

    def quiz_vastaus_polku(self) -> Path:
        return self.kayttaja_data_dir() / "quiz_results.json"

    def quiz_tila_polku(self) -> Path:
        return self.kayttaja_data_dir() / "quiz_sessions.json"

    def resolve_local_ui_path(self, raw_path: str) -> Path | None:
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
            abs_path = self.resource_root / rel
            if abs_path.exists():
                return abs_path
        return None

    def normalize_ui_asset_ref(self, raw_path: str) -> str:
        resolved = self.resolve_local_ui_path(raw_path)
        if not resolved:
            return raw_path

        try:
            rel = resolved.relative_to(self.resource_root).as_posix()
            return f"/{rel}"
        except ValueError:
            return raw_path


def start_static_server(paths: ProjectPaths) -> tuple[ThreadingHTTPServer, int]:
    allowed_root = (paths.resource_root / "src" / "ui").resolve()

    class UiOnlyRequestHandler(SimpleHTTPRequestHandler):
        def _is_allowed_filesystem_target(self) -> bool:
            resolved_target = Path(self.translate_path(self.path)).resolve()
            return resolved_target == allowed_root or allowed_root in resolved_target.parents

        def send_head(self):
            if not is_allowed_static_path(self.path) or not self._is_allowed_filesystem_target():
                self.send_error(404, "File not found")
                return None
            return super().send_head()

    handler = partial(UiOnlyRequestHandler, directory=str(paths.resource_root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, server.server_port
