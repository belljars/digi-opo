from __future__ import annotations

import os
from pathlib import Path
import sys

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

if sys.platform.startswith("linux"):
    os.environ.setdefault("QT_API", "pyqt6")

if sys.platform.startswith("linux") and os.environ.get("WAYLAND_DISPLAY"):
    os.environ.setdefault("QT_QPA_PLATFORM", "xcb")

from backend_rajapinta import Api as BackendApi
from projekti_paths import ProjectPaths, start_static_server
import webview


def _project_root() -> Path:
    # Palauttaa projektin juurikansion, jonka pohjalta muut polut lasketaan

    return Path(__file__).resolve().parents[2]


class Api(BackendApi):
    def __init__(self) -> None:
        # Luo yhteensopivan API-fasadin nykyiselle kaytolle ja testeille

        super().__init__(ProjectPaths(_project_root()))


def main() -> None:
    # Kaynnistaa paikallisen palvelimen ja avaa pywebview-ikkunan
    paths = ProjectPaths(_project_root())
    api = Api()
    server, port = start_static_server(paths)
    try:
        webview.create_window(
            "digi-opo",
            f"http://127.0.0.1:{port}{paths.ui_index_path()}",
            js_api=api,
            width=1024,
            height=768,
        )
        webview.start(gui="qt")
    finally:
        server.shutdown()
        server.server_close()
        api.close()


if __name__ == "__main__":
    main()
