from __future__ import annotations  # Siirtää tyyppivihjeiden tulkinnan myöhemmäksi

import os  # Lukee ja asettaa ympäristömuuttujia alustakohtaista käynnistystä varten
from pathlib import Path  # Käsittelee tiedostopolkuja käyttöjärjestelmäriippumattomasti
import sys  # Tarkistaa alustan ja täydentää Pythonin import-hakupolkua

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

if sys.platform.startswith("linux"):
    os.environ.setdefault("QT_API", "pyqt6")

if sys.platform.startswith("linux") and os.environ.get("WAYLAND_DISPLAY"):
    os.environ.setdefault("QT_QPA_PLATFORM", "xcb")

from backend_rajapinta import Api as BackendApi  # Tuo backendin julkisen API-luokan käyttöliittymän käyttöön
from projekti_paths import (  # Tuo polku- ja palvelinapurit käyttöliittymän käynnistystä varten
    ProjectPaths,  # Kokoaa projektin tärkeät tiedostopolut yhteen olioon
    is_allowed_static_path,  # Tarkistaa, mitä UI-polkuja staattinen palvelin saa tarjoilla
    start_static_server,  # Käynnistää paikallisen HTTP-palvelimen pywebview-ikkunaa varten
)
import webview  # Avaa HTML-käyttöliittymän työpöytäsovelluksen ikkunaan


def _project_root() -> Path:
    if getattr(sys, "frozen", False):
        bundled_root = getattr(sys, "_MEIPASS", None)
        if bundled_root:
            return Path(bundled_root).resolve()
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def _project_paths() -> ProjectPaths:
    project_root = _project_root()
    if getattr(sys, "frozen", False):
        return ProjectPaths.for_runtime(project_root)
    return ProjectPaths(project_root)


class Api(BackendApi):

    def __init__(self) -> None:
        # Alustaa backendin projektin juuren pohjalta
        super().__init__(_project_paths())


def main() -> None:
    paths = _project_paths()
    api = Api()
    if getattr(sys, "frozen", False):
        # Pakattu EXE kaynnistyy aina puhtaalta käyttäjatilalta

        api.delete_user_info()
    server, port = start_static_server(paths)
    try:
        window = webview.create_window(
            "digi-opo",
            f"http://127.0.0.1:{port}{paths.ui_index_path()}",
            js_api=api,
            width=1024,
            height=768,
        )
        if window is not None:
            api.set_window(window)
        webview.start(gui="qt")
    finally:
        server.shutdown()
        server.server_close()
        api.close()


if __name__ == "__main__":
    main()
